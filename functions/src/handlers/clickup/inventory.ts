import { onRequest } from "firebase-functions/v2/https";
import crypto from "crypto";
import { ClickupWebhook, CustomField } from "../../models/clickupWebhook";
import { CustomField as CustomFieldTask } from "../../models/clickupTask";
import { getTask } from "../../services/clickupClient";
import { Sku } from "../../models/sku";
import { db } from "../../index";


const getCustomFieldValue = (customField: CustomField | CustomFieldTask, customFieldId: string): string | null => {
  if (customField.type === "drop_down" && customField.type_config?.options) {
    const option = customField.type_config.options.find(
      (opt) => opt.id === customFieldId
    );
    return option ? option.name : null;
  }
  return null;
}

export const inventory = onRequest(async (req, res) => {
  let action = "";
  try {

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    if (process.env.DEBUG === "true") {
      console.log("Payload received:", JSON.stringify(req.body, null, 2));
      console.log("Webhook headers:", req.headers);
    }

    action = "Verifying webhook signature";
    const secret = process.env.CLICKUP_WEBHOOK_SECRET as string; // Asegúrate de que tu secreto esté en la configuración
    const receivedSignature = req.headers["x-signature"];

    const body = JSON.stringify(req.body);

    const hash = crypto.createHmac("sha256", secret).update(body);
    const generatedSignature = hash.digest("hex");

    if (receivedSignature !== generatedSignature) {
      console.error(`Invalid signature. Received: ${receivedSignature}, Generated: ${generatedSignature}`);
      res.status(401).send("Invalid signature");;
      return;
    }

    action = "Parsing webhook payload";
    const data = req.body as ClickupWebhook;

    if (!data.task_id) {
      console.error("No task_id found in webhook payload");
      res.status(400).send("No task_id found in payload");
      return;
    }

    action = "Fetching SKU from Firestore";
    const skuSnap = await db.collection("skus").doc(data.task_id).get()

    console.log("SKU found:", skuSnap.data());

    if (skuSnap.exists) {
      const updatedData: Record<string, any> = {};
      data.history_items.forEach((item) => {
        if (item.field === "custom_field") {
          const customField = item.custom_field;
          let value: string | number | null = null;
          if (customField.type === "drop_down") {
            value = getCustomFieldValue(customField, item.after);
          } else {
            value = item.after;
          }
          switch (customField.name) {
            case "Acabado":
              updatedData["finish"] = value ? String(value) : null;
              break;
            case "Cajones":
              updatedData["unitsPerBox"] = value ? Number(value) : null;
              break;
            case "Costo Unitario SKU":
              updatedData["unitCost"] = value ? Number(value) : null;
              break;
            case "Código":
              updatedData["skuCode"] = value ? String(value) : null;
              break;
            case "Código OC":
              updatedData["skuCodeForOrdering"] = value ? String(value) : null;
              break;
            case "Espesor":
              updatedData["thickness"] = value ? String(value) : null;
              break;
            case "Inventario actual":
              updatedData["currentStock"] = value ? Number(value) : null;
              break;
            case "Inventario en tránsito":
              updatedData["transitStock"] = value ? Number(value) : null;
              break;
            case "Meses cobertura":
              updatedData["monthsCoverage"] = value ? Number(value) : null;
              break;
            case "Precio venta":
              updatedData["sellingPrice"] = value ? Number(value) : null;
              break;
            case "Promedio venta mensual":
              updatedData["avgMonthlySales"] = value ? Number(value) : null;
              break;
            case "Punto de quiebre":
              updatedData["breakpoint"] = value ? Number(value) : null;
              break;
            case "Tamaño":
              updatedData["size"] = value ? String(value) : null;
              break;
            case "Tipo":
              updatedData["type"] = value ? String(value) : null;
              break;
          }
        } else if (item.field === "name") {
          updatedData["name"] = item.after;
        } else if (item.field === "status") {
          updatedData["status"] = item.after.status;
          updatedData["isActive"] = item.after.status === "activo";
        }

      });

      updatedData["updatedAt"] = new Date();

      console.log("Updated data:", updatedData);

      await db.collection("skus").doc(data.task_id).update(updatedData);

    } else {
      const task = await getTask(data.task_id);
      console.log("Task found:", task);

      const skuData: Record<string, any> = {
        id: data.task_id,
        name: task.name,
        status: task.status.status,
        isActive: task.status.status === "activo",
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      };

      task.custom_fields.forEach((field: CustomFieldTask) => {
        switch (field.name) {
          case "Acabado":
            skuData["finish"] = field.value ? String(field.value) : null;
            break;
          case "Cajones":
            skuData["unitsPerBox"] = field.value ? Number(field.value) : null;
            break;
          case "Costo Unitario SKU":
            skuData["unitCost"] = field.value ? Number(field.value) : null;
            break;
          case "Código":
            skuData["skuCode"] = field.value ? String(field.value) : null;
            break;
          case "Código OC":
            skuData["skuCodeForOrdering"] = field.value ? String(field.value) : null;
            break;
          case "Espesor":
            skuData["thickness"] = field.value ? String(field.value) : null;
            break;
          case "Inventario actual":
            skuData["currentStock"] = field.value ? Number(field.value) : null;
            break;
          case "Inventario en tránsito":
            skuData["transitStock"] = field.value ? Number(field.value) : null;
            break;
          case "Meses cobertura":
            skuData["monthsCoverage"] = field.value ? Number(field.value) : null;
            break;
          case "Precio venta":
            skuData["sellingPrice"] = field.value ? Number(field.value) : null;
            break;
          case "Promedio venta mensual":
            skuData["avgMonthlySales"] = field.value ? Number(field.value) : null;
            break;
          case "Punto de quiebre":
            skuData["breakpoint"] = field.value ? Number(field.value) : null;
            break;
          case "Tamaño":
            skuData["size"] = field.value ? String(field.value) : null;
            break;
          case "Tipo":
            skuData["type"] = getCustomFieldValue(field, field.id);
            break;
        }
      });

      const sku: Sku = {
        skuId: data.task_id,
        name: skuData.name,
        status: skuData.status,
        finish: skuData.finish,
        unitsPerBox: skuData.unitsPerBox,
        unitCost: skuData.unitCost,
        skuCode: skuData.skuCode,
        skuCodeForOrdering: skuData.skuCodeForOrdering,
        thickness: skuData.thickness,
        currentStock: skuData.currentStock,
        transitStock: skuData.transitStock,
        monthsCoverage: skuData.monthsCoverage,
        sellingPrice: skuData.sellingPrice,
        avgMonthlySales: skuData.avgMonthlySales,
        breakpoint: skuData.breakpoint,
        size: skuData.size,
        type: skuData.type,
        isActive: skuData.isActive,
        createdAt: skuData.createdAt,
        updatedAt: skuData.updatedAt,
      };

      console.log("SKU data:", skuData);

      await db.collection("skus").doc(data.task_id).set(sku);

      
      
    }
    action = "Processing history items";

    res.status(200).send("Webhook processed successfully");

  } catch (error) {
    console.error(`Error during action: ${action}`, error);
  }
});