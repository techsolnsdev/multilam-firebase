import { onRequest } from "firebase-functions/v2/https";

const CLICKUP_SECRET_NAME = "CLICKUP_API_KEY";

// ======================
// LIST IDs
// ======================
const LIST_INVENTORY_ID = "901322661524";
const LIST_REPLENISH_ID = "901323933175";
const LIST_PURCHASE_ORDERS_ID = "901322922995";
const LIST_SKU_LINES_ID = "901322949302";



// ======================
// PURCHASE ORDER FIELDS
// ======================
const CF_PO_ETA = "b625fa98-92ab-40b4-ae28-d3f2e853acba";
const CF_PO_SKU_LINES = "8a5ffa69-bfeb-4854-b0fa-233f461c8f6f";
const CF_PO_PREVIOUS_ETA = "b721987f-984e-43b0-964d-4b7e8b601ace"; // Guardar ETA anterior

const PO_SYSTEM_OUTPUT_CF_IDS = new Set([
  CF_PO_PREVIOUS_ETA,  // guardamos el ETA anterior al finalizar
]);
// ======================
// SKU LINE FIELDS
// ======================
const CF_LINE_QUANTITY = "747f1224-f299-4083-a4e7-fdceb24cb347";
const CF_LINE_SKU_CODE = "723fad06-44ab-4096-a816-6a70fda46d13";
const CF_LINE_PO_RELATION = "8a5ffa69-bfeb-4854-b0fa-233f461c8f6f";

// ======================
// REPLENISHMENT FIELDS
// ======================
const CF_REP_SKU_CODE = "723fad06-44ab-4096-a816-6a70fda46d13"; //Código OC
const CF_REP_PO_RELATION = "013f491c-8253-4b5d-b598-ac9219e7c516";
const CF_REP_TOTAL_IN_TRANSIT = "cfd3983b-ac3e-44e7-9286-6927b327b377"; // Total en tránsito

// ======================
// INVENTORY FIELDS
// ======================
const CF_INV_SKU_CODE = "24913788-1f3d-49b6-a902-35609b4068ac";
const CF_INV_ACTUAL_STOCK = "6e8837d7-0127-4659-bf4a-bd415a269947";
const CF_INV_IN_TRANSIT = "fc970cc5-938e-4d09-a695-57752cc8c406";
const CF_INV_PURCHASES_ORDERS = "b6a3ef2c-029f-412b-be0d-1103229c1194";

// ======================
// MONTH FIELDS
// ======================
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

// ======================
// ANTI-LOOP CONTROL FIELDS
// ======================
const CF_LAST_WEBHOOK_TAG = "ceb8674e-6fb1-47bc-a560-66f2f9bef6b2";
const CF_LAST_WEBHOOK_TIME = "b721987f-984e-43b0-964d-4b7e8b601ace";

// ======================
// WEBHOOK TAGS
// ======================
const WEBHOOK_TAGS = {
  INVENTORY_CALC: "wh_inv_calc_v2",
  PO_STATUS_UPDATE: "wh_po_status_v1",
  PO_ETA_UPDATE: "wh_po_eta_v2", // Incrementado versión
  PO_CLOSURE: "wh_po_closure_v1"
} as const;

// ======================
// STATUSES
// ======================
const PO_STATUS_CLOSED = "cerrada";

const IGNORE_WINDOW_MS = 15000;

// ======================
// Types
// ======================
type ClickUpCustomField = { id: string; value?: unknown };
type ClickUpTask = {
  id: string;
  custom_fields?: ClickUpCustomField[];
  status?: { status?: string };
};
type ClickUpListTasksResponse = { tasks: ClickUpTask[] };

type ClickUpWebhookPayload = {
  task_id?: string;
  list_id?: string;
  task?: { id?: string };
  list?: { id?: string };
  history_items?: Array<{ custom_field?: { id?: string }; before?: unknown; after?: unknown;[k: string]: unknown }>;
  [k: string]: unknown;
};

type MonthName = keyof typeof CF_MONTHS;

// ======================
// Helpers
// ======================
function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getCF(task: ClickUpTask, cfId: string): unknown | null {
  const f = (task.custom_fields || []).find(x => x.id === cfId);
  return f?.value ?? null;
}

function getTaskStatus(task: ClickUpTask): string | null {
  return task.status?.status || null;
}

function getChangedFields(event: ClickUpWebhookPayload): string[] {
  return (event.history_items || [])
    .map(h => h.field)
    .filter((f): f is string => typeof f === 'string');
}

/**
* Obtiene el valor anterior de un campo desde history_items
*/
function getPreviousFieldValue(event: ClickUpWebhookPayload, fieldId: string): unknown | null {
  const historyItem = (event.history_items || []).find(h => h.field === fieldId);
  return historyItem?.before ?? null;
}

/**
* Extrae el nombre del mes en inglés desde un timestamp
*/
function getMonthNameFromTimestamp(timestamp: number): MonthName | null {
  if (!timestamp || timestamp === 0) return null;

  const date = new Date(timestamp);
  const monthIndex = date.getMonth();
  const monthNames: MonthName[] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return monthNames[monthIndex];
}

/**
* Anti-loop: verifica si debe procesar el webhook
*/
function shouldProcessWebhook(
  webhookTag: string,
  task: ClickUpTask,
  requiredFields?: string[],
  changedFields?: string[]
): boolean {
  console.log(`[ANTI_LOOP] Verificando webhook tag: ${webhookTag}`);

  if (requiredFields && changedFields) {
    const hasRelevantChange = changedFields.some(f => requiredFields.includes(f));
    if (!hasRelevantChange) {
      console.log(`[ANTI_LOOP] ⏭️ No cambió ningún campo relevante:`, requiredFields);
      return false;
    }
  }

  const lastTag = getCF(task, CF_LAST_WEBHOOK_TAG);
  const lastTime = getCF(task, CF_LAST_WEBHOOK_TIME);

  if (String(lastTag) === webhookTag && lastTime !== null) {
    const deltaMs = Date.now() - toNumber(lastTime, 0);
    console.log(`[ANTI_LOOP] Delta desde último procesamiento: ${deltaMs}ms`);

    if (deltaMs >= 0 && deltaMs <= IGNORE_WINDOW_MS) {
      console.log(`[ANTI_LOOP] 🔄 Ignorando - mismo webhook ejecutó hace ${deltaMs}ms`);
      return false;
    }
  }

  console.log(`[ANTI_LOOP] ✅ Debe procesarse`);
  return true;
}

/**
* Marca una task como procesada por un webhook
*/
async function markAsProcessedByWebhook(
  token: string,
  taskId: string,
  webhookTag: string
): Promise<void> {
  const nowMs = Date.now();
  await updateTaskCustomFields(token, taskId, [
    { id: CF_LAST_WEBHOOK_TAG, value: webhookTag },
    { id: CF_LAST_WEBHOOK_TIME, value: nowMs }
  ]);
}

async function cuFetch<T>(token: string, path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    ...opts,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[API_ERROR] ${res.status}:`, errorText);
    throw new Error(`ClickUp API error ${res.status}: ${errorText}`);
  }
  return (await res.json()) as T;
}

async function getTask(token: string, taskId: string): Promise<ClickUpTask> {
  return await cuFetch<ClickUpTask>(token, `/task/${taskId}`);
}

async function updateTaskCustomFields(
  token: string,
  taskId: string,
  custom_fields: Array<{ id: string; value: unknown }>,
  maxRetries = 3
): Promise<void> {
  console.log(`[UPDATE] Actualizando task ${taskId} con ${custom_fields.length} campos`);

  // El endpoint Set Custom Field Value requiere un POST por campo
  // POST /api/v2/task/{task_id}/field/{field_id}  body: { value }
  for (const field of custom_fields) {
    console.log(`[UPDATE] Seteando campo ${field.id} → ${JSON.stringify(field.value)}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await cuFetch(token, `/task/${taskId}/field/${field.id}`, {
          method: "POST",
          body: JSON.stringify({ value: field.value })
        });
        console.log(`[UPDATE] ✅ Campo ${field.id} actualizado (intento ${attempt})`);
        break; // Salir del retry loop si fue exitoso
      } catch (err) {
        console.error(`[UPDATE] ❌ Error campo ${field.id} intento ${attempt}/${maxRetries}:`, err);
        if (attempt === maxRetries) throw err;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  console.log(`[UPDATE] ✅ Todos los campos actualizados en task ${taskId}`);
}

async function updateTaskStatus(
  token: string,
  taskId: string,
  statusName: string,
  maxRetries = 3
): Promise<void> {
  console.log(`[STATUS] Actualizando status de task ${taskId} a "${statusName}"`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cuFetch(token, `/task/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: statusName })
      });
      console.log(`[STATUS] ✅ Status actualizado (intento ${attempt})`);
      return;
    } catch (err) {
      console.error(`[STATUS] ❌ Error en intento ${attempt}/${maxRetries}:`, err);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

async function getRelatedTasks(
  token: string,
  task: ClickUpTask,
  relationshipFieldId: string
): Promise<ClickUpTask[]> {
  const relationValue = getCF(task, relationshipFieldId);

  if (!relationValue || !Array.isArray(relationValue)) {
    console.log(`[RELATIONS] No hay tasks relacionadas en campo ${relationshipFieldId}`);
    return [];
  }

  console.log(`[RELATIONS] Valor de relationValue:`, JSON.stringify(relationValue));

  console.log(`[RELATIONS] Encontradas ${relationValue.length} tasks relacionadas`);

  const tasks: ClickUpTask[] = [];
  for (const task of relationValue) {
    try {
      const relatedTask = await getTask(token, String(task.id));
      tasks.push(relatedTask);
    } catch (err) {
      console.error(`[RELATIONS] Error obteniendo task ${task.id}:`, err);
    }
  }

  return tasks;
}

async function findTaskBySKUCode(
  token: string,
  listId: string,
  skuCode: string
): Promise<ClickUpTask | null> {
  console.log(`[FIND_SKU] Buscando SKU "${skuCode}" en lista ${listId}`);

  // Filtrar directamente por el custom field en la API
  // Evita traer toda la lista y buscar en memoria
  // const params = new URLSearchParams({
  //   include_closed: "true",
  //   [`custom_fields[${CF_REP_SKU_CODE}]`]: skuCode
  // });

  const data = await cuFetch<ClickUpListTasksResponse>(
    token,
    `/list/${listId}/task?custom_fields=[{"field_id": "${CF_REP_SKU_CODE}", "operator": "=", "value": "${skuCode}"}]`
  );

  console.log(`[FIND_SKU] Tasks encontradas con SKU "${skuCode}": ${data.tasks.length}`);

  const found = data.tasks[0] ?? null;

  if (found) {
    console.log(`[FIND_SKU] ✅ Encontrada task: ${found.id}`);
  } else {
    console.log(`[FIND_SKU] ❌ No encontrada`);
  }

  return found;
}

async function addPORelationship(
  token: string,
  taskId: string,
  relationshipFieldId: string,
  poTaskId: string
): Promise<void> {
  console.log(`[RELATION] Agregando PO ${poTaskId} a task ${taskId}`);

  const task = await getTask(token, taskId);
  const currentRelations = getCF(task, relationshipFieldId);

  let relations: string[] = [];
  if (Array.isArray(currentRelations)) {
    relations = currentRelations.map(String);
  }

  if (!relations.includes(poTaskId)) {
    await updateTaskCustomFields(token, taskId, [
      { id: relationshipFieldId, value: { add: [poTaskId] } }
    ]);
    console.log(`[RELATION] ✅ PO agregada a relaciones`);
  } else {
    console.log(`[RELATION] ⏭️ PO ya existe en relaciones`);
  }
}

async function removePORelationship(
  token: string,
  taskId: string,
  relationshipFieldId: string,
  poTaskId: string
): Promise<void> {
  console.log(`[RELATION] Removiendo PO ${poTaskId} de task ${taskId}`);

  await updateTaskCustomFields(token, taskId, [
    { id: relationshipFieldId, value: { rem: [poTaskId] } }
  ]);

  console.log(`[RELATION] ✅ PO removida de relaciones`);
}

/**
* Calcula el total de todos los meses de reposición
*/
function calculateTotalInTransit(repTask: ClickUpTask): number {
  let total = 0;

  for (const monthName of Object.keys(CF_MONTHS) as MonthName[]) {
    const monthFieldId = CF_MONTHS[monthName];
    const monthValue = toNumber(getCF(repTask, monthFieldId), 0);
    total += monthValue;
  }

  console.log(`[TOTAL_TRANSIT] Total calculado: ${total}`);
  return total;
}

// ======================
// WEBHOOK 1: PO Status Update
// ======================
export const poStatusUpdate = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120
  },
  async (req, res) => {
    console.log("\n========================================");
    console.log("[PO_STATUS] Webhook recibido");
    console.log("========================================\n");

    res.status(200).send("ok");

    try {
      const token = process.env.CLICKUP_API_KEY as string;
      const event = req.body as ClickUpWebhookPayload;

      const taskId = event.task_id || event.task?.id;
      const listId = LIST_PURCHASE_ORDERS_ID;

      console.log("[PO_STATUS] Task ID:", taskId);
      console.log("[PO_STATUS] List ID:", listId);

      if (!taskId || String(listId) !== LIST_PURCHASE_ORDERS_ID) {
        console.log("[PO_STATUS] ⏭️ No es lista de Purchase Orders, ignorando");
        return;
      }

      const changedFields = getChangedFields(event);
      console.log("[PO_STATUS] Campos cambiados:", changedFields);

      if (!changedFields.includes('status')) {
        console.log("[PO_STATUS] ⏭️ No cambió status, ignorando");
        return;
      }

      const poTask = await getTask(token, taskId);
      const newStatus = getTaskStatus(poTask);

      console.log("[PO_STATUS] Nuevo status:", newStatus);

      if (newStatus === PO_STATUS_CLOSED) {
        console.log("[PO_STATUS] ⏭️ Status es 'cerrada', delegando a webhook de cierre");
        return;
      }

      if (!shouldProcessWebhook(
        WEBHOOK_TAGS.PO_STATUS_UPDATE,
        poTask,
        ['status'],
        changedFields
      )) {
        return;
      }

      const skuLines = await getRelatedTasks(token, poTask, CF_PO_SKU_LINES);

      console.log(`[PO_STATUS] Actualizando ${skuLines.length} líneas de SKU...`);

      for (const line of skuLines) {
        console.log(`[PO_STATUS] Actualizando línea ${line.id} a status "${newStatus}"`);
        await updateTaskStatus(token, line.id, newStatus!);
        await markAsProcessedByWebhook(token, line.id, WEBHOOK_TAGS.PO_STATUS_UPDATE);
      }

      await markAsProcessedByWebhook(token, poTask.id, WEBHOOK_TAGS.PO_STATUS_UPDATE);

      console.log("\n[PO_STATUS] ✅ Proceso completado");
      console.log("========================================\n");

    } catch (err) {
      console.error("\n❌ [PO_STATUS] Error:", err);
      console.error("Stack:", err instanceof Error ? err.stack : "N/A");
    }
  }
);



// ======================
// WEBHOOK 2: PO ETA Update (MEJORADO)
// ======================
export const poEtaUpdate = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 180
  },
  async (req, res) => {
    console.log("\n========================================");
    console.log("[PO_ETA] Webhook recibido");
    console.log("========================================\n");

    res.status(200).send("ok");

    try {
      const token = process.env.CLICKUP_API_KEY as string;
      const event = req.body as ClickUpWebhookPayload;

      const taskId = event.task_id || event.task?.id;
      const listId = LIST_PURCHASE_ORDERS_ID;

      console.log("[PO_ETA] Task ID:", taskId);
      console.log("[PO_ETA] List ID:", listId);

      console.log("[WEBHOOK] Payload:", JSON.stringify(event, null, 2));

      if (!taskId || String(listId) !== LIST_PURCHASE_ORDERS_ID) {
        console.log("[PO_ETA] ⏭️ No es lista de Purchase Orders, ignorando");
        return;
      }

      const historyItem = event.history_items?.[0];

      const changedCfId = historyItem?.custom_field?.id;

      console.log("[STEP 0] Campo modificado:", changedCfId ?? "(no disponible)");

      if (changedCfId !== undefined) {
        // Si es un campo que nosotros mismos escribimos → loop → abortar
        if (PO_SYSTEM_OUTPUT_CF_IDS.has(changedCfId)) {
          console.log(`[STEP 0] 🔄 LOOP — campo "${changedCfId}" es output del sistema. Abortando.`);
          return;
        }

        // Si no es CF_PO_ETA → este webhook no aplica
        if (changedCfId !== CF_PO_ETA) {
          console.log(`[STEP 0] ⏭️ Campo "${changedCfId}" no es ETA. Ignorando.`);
          return;
        }

        console.log(`[STEP 0] ✅ Campo ETA modificado — procesando`);
      } else {
        // Sin history_items → disparo manual / test → dejar pasar
        console.log("[STEP 0] ⚠️ Sin history_items — disparo manual, continuando");
      }

      const poTask = await getTask(token, taskId);

      // if (!shouldProcessWebhook(
      //   WEBHOOK_TAGS.PO_ETA_UPDATE,
      //   poTask,
      //   [CF_PO_ETA],
      //   changedFields
      // )) {
      //   return;
      // }

      // Obtener ETA nuevo y anterior
      const newEtaValue = getCF(poTask, CF_PO_ETA);
      const previousEtaValue = event.history_items ? event.history_items[0].before : "";

      console.log("[PO_ETA] ETA anterior (from history):", previousEtaValue);
      console.log("[PO_ETA] ETA nuevo:", newEtaValue);

      if (!newEtaValue) {
        console.log("[PO_ETA] ⚠️ ETA nuevo está vacío, abortando");
        return;
      }

      const newEtaTimestamp = toNumber(newEtaValue, 0);
      const newEtaMonth = getMonthNameFromTimestamp(newEtaTimestamp);

      if (!newEtaMonth) {
        console.log("[PO_ETA] ❌ No se pudo extraer mes del ETA nuevo");
        return;
      }

      console.log(`[PO_ETA] ETA Nuevo Mes: ${newEtaMonth}`);

      // --- Diagnóstico explícito del valor anterior ---
      console.log("[PO_ETA] previousEtaValue raw:", previousEtaValue);
      console.log("[PO_ETA] previousEtaValue type:", typeof previousEtaValue);
      console.log("[PO_ETA] previousEtaValue toNumber:", toNumber(previousEtaValue, 0));

      let previousEtaMonth: MonthName | null = null;
      let isEtaMonthChange = false;
      let isFirstEtaSet = false;

      const previousEtaTimestamp = toNumber(previousEtaValue, 0);

      // Un timestamp válido de ETA siempre será > 0 y razonablemente grande
      // Los timestamps de ClickUp están en milisegundos (13 dígitos aprox)
      const isValidPreviousTimestamp = previousEtaTimestamp > 1000000000;

      console.log("[PO_ETA] previousEtaTimestamp:", previousEtaTimestamp);
      console.log("[PO_ETA] isValidPreviousTimestamp:", isValidPreviousTimestamp);

      if (!isValidPreviousTimestamp) {
        // No había ETA anterior válido → primera vez
        isFirstEtaSet = true;
        console.log("[PO_ETA] 🆕 Primera vez que se setea el ETA (no había timestamp válido anterior)");
      } else {
        previousEtaMonth = getMonthNameFromTimestamp(previousEtaTimestamp);
        console.log(`[PO_ETA] ETA Anterior Mes: ${previousEtaMonth}`);

        if (previousEtaMonth && previousEtaMonth !== newEtaMonth) {
          // Cambió de mes
          isEtaMonthChange = true;
          console.log(`[PO_ETA] 🔄 CAMBIO DE MES: ${previousEtaMonth} → ${newEtaMonth}`);
        } else {
          // Mismo mes, solo cambió el día → no tocar reposiciones
          console.log(`[PO_ETA] ⏭️ MISMO MES (${newEtaMonth}), solo cambió el día. No se actualizan reposiciones`);
          return;
        }
      }

      const shouldUpdateReplenishment = isFirstEtaSet || isEtaMonthChange;

      console.log(`[PO_ETA] isFirstEtaSet: ${isFirstEtaSet}`);
      console.log(`[PO_ETA] isEtaMonthChange: ${isEtaMonthChange}`);
      console.log(`[PO_ETA] shouldUpdateReplenishment: ${shouldUpdateReplenishment}`);

      const newMonthFieldId = CF_MONTHS[newEtaMonth];
      const previousMonthFieldId = previousEtaMonth ? CF_MONTHS[previousEtaMonth] : null;

      // Obtener líneas de SKU
      const skuLines = await getRelatedTasks(token, poTask, CF_PO_SKU_LINES);
      console.log(`[PO_ETA] Procesando ${skuLines.length} líneas de SKU...`);

      // Agrupar cantidades por SKU code
      const skuQuantities = new Map<string, number>();

      for (const line of skuLines) {
        const skuCode = String(getCF(line, CF_LINE_SKU_CODE));
        const quantity = toNumber(getCF(line, CF_LINE_QUANTITY), 0);

        console.log(`[PO_ETA] Línea ${line.id}: SKU "${skuCode}", Cantidad: ${quantity}`);

        const currentQty = skuQuantities.get(skuCode) || 0;
        skuQuantities.set(skuCode, currentQty + quantity);
      }

      console.log(`[PO_ETA] SKUs únicos encontrados: ${skuQuantities.size}`);

      // Procesar cada SKU
      for (const [skuCode, totalQuantity] of skuQuantities.entries()) {
        console.log(`\n[PO_ETA] === Procesando SKU "${skuCode}" ===`);
        console.log(`[PO_ETA] Cantidad total: ${totalQuantity}`);

        // --- REPOSICIONES ---
        const repTask = await findTaskBySKUCode(token, LIST_REPLENISH_ID, skuCode);

        if (!repTask) {
          console.log(`[PO_ETA] ⚠️ No se encontró task de reposición para SKU "${skuCode}"`);
        } else {

          if (shouldUpdateReplenishment) {
            const fieldsToUpdate: Array<{ id: string; value: unknown }> = [];

            // Si cambió de mes, restar del mes anterior
            if (isEtaMonthChange && previousMonthFieldId) {
              const oldMonthValue = toNumber(getCF(repTask, previousMonthFieldId), 0);
              const newOldMonthValue = Math.max(0, oldMonthValue - totalQuantity);

              console.log(`[PO_ETA] Restando mes anterior ${previousEtaMonth}: ${oldMonthValue} - ${totalQuantity} = ${newOldMonthValue}`);

              fieldsToUpdate.push({ id: previousMonthFieldId, value: newOldMonthValue });
            }

            // Sumar al mes nuevo
            const currentNewMonthValue = toNumber(getCF(repTask, newMonthFieldId), 0);
            const updatedNewMonthValue = currentNewMonthValue + totalQuantity;

            console.log(`[PO_ETA] Sumando mes nuevo ${newEtaMonth}: ${currentNewMonthValue} + ${totalQuantity} = ${updatedNewMonthValue}`);

            fieldsToUpdate.push({ id: newMonthFieldId, value: updatedNewMonthValue });

            await updateTaskCustomFields(token, repTask.id, fieldsToUpdate);

            // Recalcular total en tránsito
            const updatedRepTask = await getTask(token, repTask.id);
            const totalInTransit = calculateTotalInTransit(updatedRepTask);

            await updateTaskCustomFields(token, repTask.id, [
              { id: CF_REP_TOTAL_IN_TRANSIT, value: totalInTransit }
            ]);

            console.log(`[PO_ETA] ✅ Total en tránsito actualizado: ${totalInTransit}`);
          } else {
            console.log(`[PO_ETA] ⏭️ Reposiciones sin cambios (mismo mes)`);
          }

          // Agregar relación PO → Reposición si no existe
          await addPORelationship(token, repTask.id, CF_REP_PO_RELATION, poTask.id);
        }

        // --- INVENTARIO: agregar relación PO si no existe ---
        // ⚠️ Reemplazar CF_INV_PURCHASES_ORDERS con el ID real cuando lo tengas
        const invTask = await findTaskBySKUCode(token, LIST_INVENTORY_ID, skuCode);

        if (!invTask) {
          console.log(`[PO_ETA] ⚠️ No se encontró task de inventario para SKU "${skuCode}"`);
        } else {
          await addPORelationship(token, invTask.id, CF_INV_PURCHASES_ORDERS, poTask.id);
          console.log(`[PO_ETA] ✅ Relación PO → Inventario verificada para SKU "${skuCode}"`);
        }
      }

      // // Marcar PO como procesada
      // await markAsProcessedByWebhook(token, poTask.id, WEBHOOK_TAGS.PO_ETA_UPDATE);

      console.log("\n[PO_ETA] ✅ Proceso completado");
      console.log("========================================\n");

    } catch (err) {
      console.error("\n❌ [PO_ETA] Error:", err);
      console.error("Stack:", err instanceof Error ? err.stack : "N/A");
    }
  }
);
// ======================
// WEBHOOK 3: PO Closure
// ======================
export const poCloseUpdate = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 180
  },
  async (req, res) => {
    console.log("\n========================================");
    console.log("[PO_CLOSE] Webhook recibido");
    console.log("========================================\n");

    res.status(200).send("ok");

    try {
      const token = process.env.CLICKUP_API_KEY as string;
      const event = req.body as ClickUpWebhookPayload;

      const taskId = event.task_id || event.task?.id;
      const listId = LIST_PURCHASE_ORDERS_ID;

      console.log("[PO_CLOSE] Task ID:", taskId);
      console.log("[PO_CLOSE] List ID:", listId);

      if (!taskId || String(listId) !== LIST_PURCHASE_ORDERS_ID) {
        console.log("[PO_CLOSE] ⏭️ No es lista de Purchase Orders, ignorando");
        return;
      }

      const changedFields = getChangedFields(event);
      console.log("[PO_CLOSE] Campos cambiados:", changedFields);

      if (!changedFields.includes('status')) {
        console.log("[PO_CLOSE] ⏭️ No cambió status, ignorando");
        return;
      }

      const poTask = await getTask(token, taskId);
      const newStatus = getTaskStatus(poTask);

      console.log("[PO_CLOSE] Nuevo status:", newStatus);

      if (newStatus !== PO_STATUS_CLOSED) {
        console.log("[PO_CLOSE] ⏭️ Status no es 'cerrada', ignorando");
        return;
      }

      if (!shouldProcessWebhook(
        WEBHOOK_TAGS.PO_CLOSURE,
        poTask,
        ['status'],
        changedFields
      )) {
        return;
      }

      const etaValue = getCF(poTask, CF_PO_ETA);

      if (!etaValue) {
        console.log("[PO_CLOSE] ⚠️ ETA está vacío, no se puede procesar cierre");
        return;
      }

      const etaTimestamp = toNumber(etaValue, 0);
      const etaMonth = getMonthNameFromTimestamp(etaTimestamp);

      if (!etaMonth) {
        console.log("[PO_CLOSE] ❌ No se pudo extraer mes del ETA");
        return;
      }

      console.log(`[PO_CLOSE] ETA Mes: ${etaMonth}`);

      const monthFieldId = CF_MONTHS[etaMonth];

      const skuLines = await getRelatedTasks(token, poTask, CF_PO_SKU_LINES);

      console.log(`[PO_CLOSE] Procesando ${skuLines.length} líneas de SKU...`);

      for (const line of skuLines) {
        const skuCode = String(getCF(line, CF_LINE_SKU_CODE));
        const quantity = toNumber(getCF(line, CF_LINE_QUANTITY), 0);

        console.log(`\n[PO_CLOSE] === Procesando línea ${line.id} ===`);
        console.log(`[PO_CLOSE] SKU: "${skuCode}", Cantidad: ${quantity}`);

        // 1. Actualizar status de línea
        console.log(`[PO_CLOSE] 1/3: Actualizando status de línea a "cerrada"`);
        await updateTaskStatus(token, line.id, PO_STATUS_CLOSED);
        await markAsProcessedByWebhook(token, line.id, WEBHOOK_TAGS.PO_CLOSURE);

        // 2. Restar de reposiciones
        console.log(`[PO_CLOSE] 2/3: Restando de reposiciones`);
        const repTask = await findTaskBySKUCode(token, LIST_REPLENISH_ID, skuCode);

        if (repTask) {
          const currentMonthValue = toNumber(getCF(repTask, monthFieldId), 0);
          const newMonthValue = Math.max(0, currentMonthValue - quantity);

          console.log(`[PO_CLOSE] Mes ${etaMonth}: ${currentMonthValue} - ${quantity} = ${newMonthValue}`);

          await updateTaskCustomFields(token, repTask.id, [
            { id: monthFieldId, value: newMonthValue }
          ]);

          // Recalcular total en tránsito
          const updatedRepTask = await getTask(token, repTask.id);
          const totalInTransit = calculateTotalInTransit(updatedRepTask);

          await updateTaskCustomFields(token, repTask.id, [
            { id: CF_REP_TOTAL_IN_TRANSIT, value: totalInTransit }
          ]);

          console.log(`[PO_CLOSE] ✅ Total en tránsito actualizado: ${totalInTransit}`);

          // Remover relación con PO
          await removePORelationship(token, repTask.id, CF_REP_PO_RELATION, poTask.id);

          console.log(`[PO_CLOSE] ✅ Reposición actualizada`);
        } else {
          console.log(`[PO_CLOSE] ⚠️ No se encontró task de reposición para SKU "${skuCode}"`);
        }

        // 3. Mover de tránsito a actual en inventario
        console.log(`[PO_CLOSE] 3/3: Actualizando inventario`);
        const invTask = await findTaskBySKUCode(token, LIST_INVENTORY_ID, skuCode);

        if (invTask) {
          const inTransit = toNumber(getCF(invTask, CF_INV_IN_TRANSIT), 0);
          const actualStock = toNumber(getCF(invTask, CF_INV_ACTUAL_STOCK), 0);

          const newInTransit = Math.max(0, inTransit - quantity);
          const newActualStock = actualStock + quantity;

          console.log(`[PO_CLOSE] In Transit: ${inTransit} - ${quantity} = ${newInTransit}`);
          console.log(`[PO_CLOSE] Actual Stock: ${actualStock} + ${quantity} = ${newActualStock}`);

          await updateTaskCustomFields(token, invTask.id, [
            { id: CF_INV_IN_TRANSIT, value: newInTransit },
            { id: CF_INV_ACTUAL_STOCK, value: newActualStock }
          ]);

          console.log(`[PO_CLOSE] ✅ Inventario actualizado`);
        } else {
          console.log(`[PO_CLOSE] ⚠️ No se encontró task de inventario para SKU "${skuCode}"`);
        }
      }

      await markAsProcessedByWebhook(token, poTask.id, WEBHOOK_TAGS.PO_CLOSURE);

      console.log("\n[PO_CLOSE] ✅ Proceso completado");
      console.log("========================================\n");

    } catch (err) {
      console.error("\n❌ [PO_CLOSE] Error:", err);
      console.error("Stack:", err instanceof Error ? err.stack : "N/A");
    }
  }
);
