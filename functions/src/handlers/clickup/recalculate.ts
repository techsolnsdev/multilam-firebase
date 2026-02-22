import { onRequest } from "firebase-functions/v2/https";

const CLICKUP_SECRET_NAME = "CLICKUP_API_KEY";

// ======================
// YOUR FIXED IDs
// ======================

const LIST_INVENTORY_ID = "901322661524";
const LIST_REPLENISH_ID = "901323933175";
const SYSTEM_CONFIG_TASK_ID = "86af2t5w1";

// SystemConfig CFs
const CF_CFG_AS_OF_YYYYMM = "483c7b85-5856-4297-8e59-101a9bc1f506";
const CF_CFG_ROLLING_START_MODE = "a739d2dc-370f-42e6-855a-03507ce1e2b6";
const CF_CFG_HORIZON_MONTHS = "b7220d54-62ab-4e9a-89c4-7b0b7ad39c35";

// SKU ID (same CF used in both lists)
const CF_SKU_ID_INV = "24913788-1f3d-49b6-a902-35609b4068ac";
const CF_SKU_ID_REP = "24913788-1f3d-49b6-a902-35609b4068ac";

// Inventory calc inputs
const CF_INV_ACTUAL_STOCK = "6e8837d7-0127-4659-bf4a-bd415a269947";
const CF_INV_BREAKPOINT = "9d75414c-0d5b-4e7a-a39e-751405091497";

// Inventory outputs — quiebre
const CF_INV_MONTH_COVERAGE = "70e9559a-4ff0-42fa-a3c8-e8ac34a732ea";
const CF_INV_BREAKUP_LABEL = "1c8fe6d9-117f-4cf5-9332-c93844a5e971";
const CF_INV_BREAKUP_YYYYMM = "95bbe137-3b78-42ca-a441-1b4c1b17c5d1";
const CF_INV_SIN_QUIEBRE = "9599f6b5-9a63-42ff-b3ee-9bfe6401d8d9";
const CF_INV_LAST_CALC = "b721987f-984e-43b0-964d-4b7e8b601ace";

// Inventory outputs — resumen
const CF_INV_TOTAL_YTD = "fdab417e-290a-4de5-bbb0-484145fa65a7";
const CF_INV_PROMEDIO_VENTAS = "42c74e98-4668-4556-957b-62551ea635b4";
const CF_INV_PROYECTADO = "4dc5f5ae-30f0-4667-8876-11ccbe40b2e6";
const CF_INV_EN_TRANSITO = "fc970cc5-938e-4d09-a695-57752cc8c406";

// Reposiciones inputs
const CF_REP_TOTAL_TRANSITO = "cfd3983b-ac3e-44e7-9286-6927b327b377";

// Status names
const STATUS_ACTIVO = "activo";
const STATUS_REQUIERE_REPOSICION = "requiere reposicion";
const COVERAGE_ALERT_THRESHOLD = 4;

// Month fields (same IDs in INV/REP)
const CF_MONTHS = {
  January: "a5d9a4c5-f480-4fdf-9db1-3ea48eaef927",
  February: "689da39f-5b87-4fd5-8554-a0842c5fb5ce",
  March: "d88006e0-d432-4a2a-9089-516ec98f778f",
  April: "8be18439-34dc-48a1-9df0-e1ff2c4b3c18",
  May: "e2aca248-4d24-4f45-b737-403773a9b33f",
  June: "b28c1d92-2b15-4268-9b81-4d62d4f44907",
  July: "3dbbd953-8e47-4a98-9068-20d546f6d794",
  August: "7995afc0-3013-433d-aebe-83d82918e625",
  September: "0d5db809-7e4e-4da1-95b8-8d8533aa5a24",
  October: "c9bfb00d-81e3-4308-b1e3-1e76f8fe5831",
  November: "58d50690-2f8b-4efc-b180-a85637a4be30",
  December: "83898723-cf03-4b09-8122-7262e5802c45"
} as const;

type MonthKey = keyof typeof CF_MONTHS;

const CF_ID_TO_MONTH = Object.fromEntries(
  Object.entries(CF_MONTHS).map(([k, v]) => [v, k as MonthKey])
) as Record<string, MonthKey>;

const MONTH_TO_INDEX: Record<MonthKey, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12
};

const CF_MONTHS_SET = new Set(Object.values(CF_MONTHS));

// Outputs del sistema — si el campo que cambió es uno de estos: loop → ignorar.
// CF_INV_ACTUAL_STOCK NO está aquí: si el usuario lo edita manualmente
// debe disparar recálculo. El loop se evita no escribiéndolo desde el webhook.
const SYSTEM_OUTPUT_CF_IDS = new Set([
  CF_INV_MONTH_COVERAGE,
  CF_INV_BREAKUP_LABEL,
  CF_INV_BREAKUP_YYYYMM,
  CF_INV_SIN_QUIEBRE,
  CF_INV_LAST_CALC,
  // Campos de resumen — también outputs del sistema
  CF_INV_TOTAL_YTD,
  CF_INV_PROMEDIO_VENTAS,
  CF_INV_EN_TRANSITO,
  CF_INV_PROYECTADO,
]);

const CF_INV_INPUTS_SET = new Set([
  CF_INV_ACTUAL_STOCK,
  CF_INV_BREAKPOINT,
]);

// ======================
// Types
// ======================
type ClickUpCustomField = { id: string; value?: unknown };
type ClickUpTask = {
  id: string;
  status?: { status?: string };
  custom_fields?: ClickUpCustomField[];
};
type ClickUpListTasksResponse = { tasks: ClickUpTask[] };

type HistoryItem = {
  // Los valores antes/después del cambio vienen en before/after (strings).
  // custom_field solo tiene metadata del campo, NO los valores.
  before?: unknown;
  after?: unknown;
  custom_field?: { id?: string };
  type?: string;
  field?: string;
  [k: string]: unknown;
};

type ClickUpWebhookPayload = {
  task_id?: string;
  task?: { id?: string };
  history_items?: HistoryItem[];
  [k: string]: unknown;
};

type RollingStartMode = "CURRENT" | "NEXT";

type CalcResult = {
  sinQuiebre: boolean;
  breakupYYYYMM: number | null;
  breakupLabel: string | null;
  monthCoverage: number;
};

type SummaryResult = {
  totalVentasYTD: number;
  promedioVentas: number;
  inventarioEnTransito: number;
  inventarioProyectado: number;
};

// ======================
// Pure helpers
// ======================
function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getCF(task: ClickUpTask, cfId: string): unknown | null {
  const f = (task.custom_fields || []).find(x => x.id === cfId);
  return f?.value ?? null;
}

const FIELD_ORDER: MonthKey[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
] as const;

function yyyymmToLabelEs(yyyymm: number): string {
  const y = Math.floor(yyyymm / 100);
  const m = (yyyymm % 100) - 1;
  return `${MONTHS_ES[m]} ${y}`;
}

/**
 * Convierte monthIndex + posición en la secuencia → YYYYMM correcto.
 * Usa tInSeq para contar cruces de diciembre y asignar el año correcto.
 */
function monthIndexToYYYYMM(
  asOfYYYYMM: number,
  monthIndex: number,
  tInSeq: number,
  seqStart: number
): number {
  const asOfYear = Math.floor(asOfYYYYMM / 100);
  const yearsAdded = Math.floor((seqStart - 1 + tInSeq) / 12);
  return (asOfYear + yearsAdded) * 100 + monthIndex;
}

/**
 * Genera la secuencia rolling de 12 índices de mes (1-12).
 * startOverride fuerza un mes de inicio distinto al determinado por startMode.
 */
function rollingMonthIndices(
  asOfYYYYMM: number,
  startMode: RollingStartMode,
  startOverride?: number
): number[] {
  let start: number;
  if (startOverride !== undefined) {
    start = startOverride;
  } else {
    const asOfMonth = asOfYYYYMM % 100;
    start = startMode === "NEXT" ? (asOfMonth % 12) + 1 : asOfMonth;
  }
  const out: number[] = [];
  for (let i = 0; i < 12; i++) out.push(((start - 1 + i) % 12) + 1);
  return out;
}

function getMonthValue(task: ClickUpTask, monthIndex: number): number {
  return toNumber(getCF(task, CF_MONTHS[FIELD_ORDER[monthIndex - 1]]), 0);
}

function epochToYYYYMM(epochMs: number): number {
  const d = new Date(epochMs);
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

/**
 * Promedio mensual usando solo meses con valor > 0.
 * Fallback de demanda en el rolling para meses sin dato histórico.
 */
function calcMonthlyAvg(invTask: ClickUpTask): number {
  const values = FIELD_ORDER
    .map(name => toNumber(getCF(invTask, CF_MONTHS[name]), 0))
    .filter(v => v > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calcula campos de resumen de la task de inventario:
 *
 *   totalVentasYTD     = suma de los 12 campos de mes (incluyendo 0s)
 *   promedioVentas     = totalVentasYTD / 12
 *   inventarioEnTransito = CF_REP_TOTAL_TRANSITO de la task de reposiciones (0 si null)
 *   inventarioProyectado = actualStock (ajustado) + inventarioEnTransito
 *
 * @param invTask      Task de inventario ya cargada
 * @param repTask      Task de reposiciones (puede ser null)
 * @param actualStock  Stock ajustado con ventas del mes en curso (del PASO 5)
 */
function calcSummaryFields(
  invTask: ClickUpTask,
  repTask: ClickUpTask | null,
  actualStock: number
): SummaryResult {
  const totalVentasYTD = FIELD_ORDER.reduce(
    (sum, name) => sum + toNumber(getCF(invTask, CF_MONTHS[name]), 0),
    0
  );

  const promedioVentas = totalVentasYTD / 12;

  const inventarioEnTransito = repTask
    ? toNumber(getCF(repTask, CF_REP_TOTAL_TRANSITO), 0)
    : 0;

  const inventarioProyectado = actualStock + inventarioEnTransito;

  console.log("[SUMMARY] Total YTD:", totalVentasYTD);
  console.log("[SUMMARY] Promedio mensual (YTD/12):", promedioVentas.toFixed(2));
  console.log("[SUMMARY] En tránsito:", inventarioEnTransito);
  console.log("[SUMMARY] Proyectado (stock+tránsito):", inventarioProyectado);

  return { totalVentasYTD, promedioVentas, inventarioEnTransito, inventarioProyectado };
}

/**
 * Ajusta el stock actual con las ventas del mes recién registrado.
 *
 * Caso FULL  — primer registro del mes (lastCalc es de otro mes o nunca hubo):
 *   adjustedStock = actualStock - valorNuevo
 *
 * Caso DELTA — actualización dentro del mismo mes (ya había cálculo previo):
 *   adjustedStock = actualStock - (valorNuevo - valorViejo)
 *
 * IMPORTANTE: el resultado NO se persiste en ClickUp para evitar loops.
 */
function calcAdjustedStock(params: {
  actualStock: number;
  valorNuevo: number;
  valorViejo: number;
  changedMonthIndex: number;
  lastCalcEpochMs: number | null;
}): { adjustedStock: number; mode: "DELTA" | "FULL" } {
  const { actualStock, valorNuevo, valorViejo, changedMonthIndex, lastCalcEpochMs } = params;

  if (!lastCalcEpochMs) {
    return { adjustedStock: actualStock - valorNuevo, mode: "FULL" };
  }

  const lastCalcMonth = epochToYYYYMM(lastCalcEpochMs) % 100;

  if (lastCalcMonth === changedMonthIndex) {
    return { adjustedStock: actualStock - (valorNuevo - valorViejo), mode: "DELTA" };
  }

  return { adjustedStock: actualStock - valorNuevo, mode: "FULL" };
}

/**
 * Simula el inventario mes a mes y detecta el primer mes de quiebre.
 *
 * El rolling empieza en el mes SIGUIENTE al mes modificado cuando el trigger
 * es un campo de mes (via rollingStartOverride), evitando doble descuento.
 * Para cambios de stock/breakpoint usa startMode del SystemConfig.
 *
 * Meses con demanda=0 usan monthlyAvg como fallback.
 */
function calcBreakupAndCoverageInt(params: {
  actualStock: number;
  breakpoint: number;
  invTask: ClickUpTask;
  repTask: ClickUpTask | null;
  monthlyAvg: number;
  asOfYYYYMM: number;
  startMode: RollingStartMode;
  rollingStartOverride?: number;
}): CalcResult {
  const {
    actualStock, breakpoint, invTask, repTask,
    monthlyAvg, asOfYYYYMM, startMode, rollingStartOverride
  } = params;

  let S = toNumber(actualStock, 0);
  const BP = toNumber(breakpoint, 0);
  const seq = rollingMonthIndices(asOfYYYYMM, startMode, rollingStartOverride);
  const seqStart = seq[0];

  console.log("[CALC] Stock inicial (S):", S, "| Breakpoint (BP):", BP);
  console.log("[CALC] Promedio mensual:", monthlyAvg.toFixed(1));
  console.log("[CALC] Secuencia rolling:", seq, "| Inicio forzado:", rollingStartOverride ?? "no");

  let fullMonthsSafe = 0;

  for (let t = 0; t < 12; t++) {
    const monthIndex = seq[t];
    const inbound = repTask ? getMonthValue(repTask, monthIndex) : 0;
    const rawDemand = getMonthValue(invTask, monthIndex);
    const demand = rawDemand > 0 ? rawDemand : monthlyAvg;
    const S_end = S + inbound - demand;

    console.log(
      `[CALC] t${t + 1} ${FIELD_ORDER[monthIndex - 1]}: ` +
      `S_ini=${S} +inbound=${inbound} -demand=${demand}${rawDemand === 0 ? "(avg)" : ""} ` +
      `= S_end=${S_end} (BP=${BP}, quiebre=${S_end < BP})`
    );

    if (S_end < BP) {
      const breakupYYYYMM = monthIndexToYYYYMM(asOfYYYYMM, monthIndex, t, seqStart);
      const result: CalcResult = {
        sinQuiebre: false,
        breakupYYYYMM,
        breakupLabel: yyyymmToLabelEs(breakupYYYYMM),
        monthCoverage: fullMonthsSafe
      };
      console.log("[CALC] ⚠️ QUIEBRE:", result);
      return result;
    }

    fullMonthsSafe += 1;
    S = S_end;
  }

  const result: CalcResult = {
    sinQuiebre: true,
    breakupYYYYMM: null,
    breakupLabel: null,
    monthCoverage: 12
  };
  console.log("[CALC] ✅ SIN QUIEBRE:", result);
  return result;
}

// ======================
// ClickUp API helpers
// ======================
async function cuFetch<T>(token: string, path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    ...opts,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  if (!res.ok) throw new Error(`ClickUp API error ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function findTaskBySKUCode(
  token: string,
  listId: string,
  skuCfId: string,
  skuCode: string
): Promise<ClickUpTask | null> {
  console.log(`[FIND_SKU] Buscando SKU "${skuCode}" en lista ${listId}`);
  const data = await cuFetch<ClickUpListTasksResponse>(
    token,
    `/list/${listId}/task?include_closed=true&custom_fields=[{"field_id":"${skuCfId}","operator":"=","value":"${skuCode}"}]`
  );
  const found = data.tasks.find(t => String(getCF(t, skuCfId)) === skuCode) ?? null;
  console.log(`[FIND_SKU] ${found ? `✅ Task: ${found.id}` : "❌ No encontrada"} (${data.tasks.length} results)`);
  return found;
}

async function updateTaskCustomFields(
  token: string,
  taskId: string,
  fields: Array<{ id: string; value: unknown }>,
  maxRetries = 3
): Promise<void> {
  console.log(`[UPDATE] Actualizando ${fields.length} campos en task ${taskId}`);
  for (const field of fields) {
    console.log(`[UPDATE] Campo ${field.id} → ${JSON.stringify(field.value)}`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await cuFetch(token, `/task/${taskId}/field/${field.id}`, {
          method: "POST",
          body: JSON.stringify({ value: field.value })
        });
        console.log(`[UPDATE] ✅ OK (intento ${attempt})`);
        break;
      } catch (err) {
        console.error(`[UPDATE] ❌ intento ${attempt}/${maxRetries}:`, err);
        if (attempt === maxRetries) throw err;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
}

async function updateStatusIfMatch(
  token: string,
  task: ClickUpTask,
  fromStatus: string,
  toStatus: string
): Promise<boolean> {
  const current = (task.status?.status ?? "").toLowerCase().trim();
  const from = fromStatus.toLowerCase().trim();
  console.log(`[STATUS] Actual: "${current}" | Esperado para cambio: "${from}"`);
  if (current !== from) {
    console.log(`[STATUS] ⏭️ No coincide — sin cambio`);
    return false;
  }
  await cuFetch(token, `/task/${task.id}`, {
    method: "PUT",
    body: JSON.stringify({ status: toStatus })
  });
  console.log(`[STATUS] ✅ "${fromStatus}" → "${toStatus}"`);
  return true;
}

// ======================
// Firebase HTTP Function
// ======================
export const recalculate = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60
  },
  async (req, res) => {
    console.log("\n========================================");
    console.log("[WEBHOOK] Recalculate recibido");
    console.log("========================================\n");

    res.status(200).send("ok");

    try {
      const token = process.env.CLICKUP_API_KEY as string;
      const event = req.body as ClickUpWebhookPayload;

      console.log("[WEBHOOK] Payload:", JSON.stringify(event, null, 2));

      // ─────────────────────────────────────────────────────────
      // PASO 0 — Anti-loop + filtro de campo relevante
      //
      // ClickUp envía un webhook por cada campo que se actualiza.
      // Si el campo es un output del sistema → lo escribimos nosotros → ignorar.
      // Si no es un campo de mes ni stock/breakpoint → irrelevante → ignorar.
      //
      // CF_INV_ACTUAL_STOCK no está en SYSTEM_OUTPUT_CF_IDS porque si el
      // usuario lo edita manualmente sí debe disparar recálculo.
      // El loop se evita no escribiendo ese campo desde el webhook (PASO 8).
      // ─────────────────────────────────────────────────────────
      const historyItem = event.history_items?.[0];
      const changedCfId = historyItem?.custom_field?.id;
      const typeField = historyItem?.field;

      console.log("[STEP 0] Campo modificado:", changedCfId ?? "(no disponible)");

      if (typeField !== "custom_field") {
        console.log("[STEP 0] ⏭️ Campo irrelevante. Ignorando.");
        return;
      }

      if (changedCfId !== undefined) {
        if (SYSTEM_OUTPUT_CF_IDS.has(changedCfId)) {
          console.log(`[STEP 0] 🔄 LOOP — output del sistema. Abortando.`);
          return;
        }

        const isMonthField = CF_MONTHS_SET.has(changedCfId as never);

        if (!isMonthField) {
          console.log(`[STEP 0] ⏭️ Campo irrelevante. Ignorando.`);
          return;
        }

        console.log(`[STEP 0] ✅ Campo válido (mes=${isMonthField})`);
      } else {
        console.log("[STEP 0] ⚠️ Sin history_items — disparo manual, continuando");
      }

      // ─────────────────────────────────────────────────────────

      const taskId = event.task_id || event.task?.id;
      const listId = LIST_INVENTORY_ID; // NO MODIFICAR

      if (!taskId) {
        console.log("[WEBHOOK] ❌ Falta taskId, abortando");
        return;
      }

      // PASO 1 — Leer task de inventario
      console.log("\n[STEP 1] Obteniendo task...");
      const invTask = await cuFetch<ClickUpTask>(token, `/task/${taskId}`);
      console.log("[STEP 1] ✅ Task:", invTask.id, "| Status:", invTask.status?.status);

      // PASO 2 — Leer SystemConfig
      console.log("\n[STEP 2] Leyendo SystemConfig...");
      const cfgTask = await cuFetch<ClickUpTask>(token, `/task/${SYSTEM_CONFIG_TASK_ID}`);
      const asOfYYYYMM = toNumber(getCF(cfgTask, CF_CFG_AS_OF_YYYYMM), 0);
      const startModeRaw = getCF(cfgTask, CF_CFG_ROLLING_START_MODE);
      const horizonMonths = toNumber(getCF(cfgTask, CF_CFG_HORIZON_MONTHS), 12);

      console.log("[STEP 2] AS_OF_YYYYMM:", asOfYYYYMM, "| MODE:", startModeRaw, "| HORIZON:", horizonMonths);

      if (!asOfYYYYMM || String(asOfYYYYMM).length !== 6) {
        console.log("[STEP 2] ❌ AS_OF_YYYYMM inválido, abortando");
        return;
      }
      void horizonMonths;

      const startMode: RollingStartMode =
        String(startModeRaw || "CURRENT").toUpperCase() === "NEXT" ? "NEXT" : "CURRENT";

      // PASO 3 — SKU ID
      console.log("\n[STEP 3] Determinando SKU ID...");
      const skuId = getCF(invTask, CF_SKU_ID_INV);
      if (!skuId) {
        console.log("[STEP 3] ❌ SKU ID no encontrado, abortando");
        return;
      }
      console.log("[STEP 3] ✅ SKU ID:", skuId);

      // PASO 4 — Reposiciones (OPCIONAL)
      console.log("\n[STEP 4] Obteniendo task de Reposiciones...");
      const repTask = await findTaskBySKUCode(token, LIST_REPLENISH_ID, CF_SKU_ID_REP, String(skuId));
      console.log("[STEP 4]", repTask ? `✅ Reposiciones: ${repTask.id}` : "⚠️ Sin reposiciones — inbound=0, tránsito=0");

      // PASO 5 — Stock ajustado + mes de inicio del rolling
      //
      // Cuando cambia un campo de mes (ventas acumuladas):
      //   1. Se ajusta el stock descontando lo vendido en ese mes.
      //   2. El rolling empieza en el mes SIGUIENTE al modificado para
      //      evitar descontar ese mes dos veces.
      //
      // Cuando cambia stock o breakpoint directamente:
      //   Sin ajuste. Rolling usa startMode normal del SystemConfig.
      //
      // CRÍTICO: el stock ajustado NO se escribe en ClickUp.
      // Persistirlo causaría un loop de descuento acumulativo.
      console.log("\n[STEP 5] Preparando stock y rolling...");

      const rawActualStock = toNumber(getCF(invTask, CF_INV_ACTUAL_STOCK), 0);
      const breakpoint = toNumber(getCF(invTask, CF_INV_BREAKPOINT), 0);
      const isMonthField = changedCfId !== undefined && CF_MONTHS_SET.has(changedCfId as never);
      let actualStock = rawActualStock;
      let rollingStartOverride: number | undefined = undefined;

      if (isMonthField && changedCfId !== undefined) {
        const monthName = CF_ID_TO_MONTH[changedCfId];
        const changedMonthIdx = MONTH_TO_INDEX[monthName];

        // Valores desde before/after del payload (no desde custom_field.value)
        const valorNuevo = toNumber(historyItem?.after, 0);
        const valorViejo = toNumber(historyItem?.before, 0);

        const lastCalcRaw = getCF(invTask, CF_INV_LAST_CALC);
        const lastCalcEpochMs = lastCalcRaw !== null ? toNumber(lastCalcRaw, 0) : null;

        console.log("[STEP 5] Mes modificado:", monthName, `(idx ${changedMonthIdx})`);
        console.log("[STEP 5] valorNuevo:", valorNuevo, "| valorViejo:", valorViejo);
        console.log("[STEP 5] lastCalc mes:", lastCalcEpochMs ? epochToYYYYMM(lastCalcEpochMs) % 100 : "N/A");

        const { adjustedStock, mode } = calcAdjustedStock({
          actualStock: rawActualStock,
          valorNuevo,
          valorViejo,
          changedMonthIndex: changedMonthIdx,
          lastCalcEpochMs
        });

        console.log(`[STEP 5] Modo: ${mode} | ${rawActualStock} → ${adjustedStock} (NO se persiste)`);

        actualStock = adjustedStock;
        rollingStartOverride = (changedMonthIdx % 12) + 1;
        console.log(`[STEP 5] Rolling desde mes: ${rollingStartOverride} (${FIELD_ORDER[rollingStartOverride - 1]})`);

      } else {
        console.log("[STEP 5] No es campo de mes — stock sin ajuste, rolling por startMode:", startMode);
      }

      console.log("[STEP 5] Stock para cálculo:", actualStock, "| Breakpoint:", breakpoint);

      // PASO 6 — Promedio mensual (fallback de demanda para meses con valor=0)
      const monthlyAvg = calcMonthlyAvg(invTask);
      console.log("[STEP 6] Promedio mensual (fallback rolling):", monthlyAvg.toFixed(1));

      // PASO 7 — Calcular quiebre y cobertura
      console.log("\n[STEP 7] Calculando quiebre...");
      const { sinQuiebre, breakupYYYYMM, breakupLabel, monthCoverage } =
        calcBreakupAndCoverageInt({
          actualStock,
          breakpoint,
          invTask,
          repTask,
          monthlyAvg,
          asOfYYYYMM,
          startMode,
          rollingStartOverride
        });

      console.log("[STEP 7] sinQuiebre:", sinQuiebre,
        "| mes:", breakupLabel ?? "—",
        "| cobertura:", monthCoverage);

      // PASO 8 — Calcular campos de resumen
      //
      //   totalVentasYTD     = suma de los 12 campos de mes
      //   promedioVentas     = totalVentasYTD / 12
      //   inventarioEnTransito = CF_REP_TOTAL_TRANSITO de reposiciones
      //   inventarioProyectado = actualStock (ajustado) + inventarioEnTransito
      console.log("\n[STEP 8] Calculando campos de resumen...");
      const { totalVentasYTD, promedioVentas, inventarioEnTransito, inventarioProyectado } =
        calcSummaryFields(invTask, repTask, actualStock);

      // PASO 9 — Escribir todos los outputs en ClickUp
      //
      // NO se incluye CF_INV_ACTUAL_STOCK: el stock ajustado es solo interno.
      // Persistirlo generaría un loop de descuento acumulativo en cada ejecución.
      console.log("\n[STEP 9] Escribiendo outputs en ClickUp...");
      const cfPayload: Array<{ id: string; value: unknown }> = [
        // Quiebre
        { id: CF_INV_SIN_QUIEBRE, value: sinQuiebre },
        { id: CF_INV_MONTH_COVERAGE, value: monthCoverage },
        { id: CF_INV_BREAKUP_YYYYMM, value: sinQuiebre ? "Sin quiebre" : String(breakupYYYYMM) },
        { id: CF_INV_BREAKUP_LABEL, value: sinQuiebre ? "Sin quiebre" : breakupLabel },
        { id: CF_INV_LAST_CALC, value: Date.now() },
        // Resumen
        { id: CF_INV_TOTAL_YTD, value: totalVentasYTD },
        { id: CF_INV_PROMEDIO_VENTAS, value: promedioVentas },
        { id: CF_INV_EN_TRANSITO, value: inventarioEnTransito },
        { id: CF_INV_PROYECTADO, value: inventarioProyectado },
      ];

      await updateTaskCustomFields(token, invTask.id, cfPayload);
      console.log("[STEP 9] ✅ Campos actualizados");

      // PASO 10 — Cambio de status si cobertura crítica
      // Solo cambia de "Activo" → "Requiere Reposición" (no sobreescribe otros flujos)
      console.log("\n[STEP 10] Evaluando status...");
      if (monthCoverage <= COVERAGE_ALERT_THRESHOLD) {
        console.log(`[STEP 10] ⚠️ Cobertura ${monthCoverage} ≤ ${COVERAGE_ALERT_THRESHOLD} — evaluando cambio`);
        await updateStatusIfMatch(token, invTask, STATUS_ACTIVO, STATUS_REQUIERE_REPOSICION);
      } else {
        console.log(`[STEP 10] ✅ Cobertura OK (${monthCoverage})`);
      }

      console.log("\n========================================");
      console.log("[WEBHOOK] ✅ Completado");
      console.log("========================================\n");

    } catch (err) {
      console.error("❌ [ERROR]:", err instanceof Error ? err.stack : err);
    }
  }
);


