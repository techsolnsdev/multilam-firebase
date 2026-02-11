import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Sku } from "../models/sku";
import { createTask, createTaskAttachment, createTaskFromTemplate, setCustomField } from "../services/clickupClient";
import { PURCHASE_ORDERS_CF_IDS, PO_LINES_CF_IDS, ACCOUNTS_PAYABLE_CF_IDS, LOGISTICS_CF_IDS, ADVANCES_CF_IDS, EXPENSE_CONCEPTS_CF_IDS, OC_ANALYSIS_CF_IDS } from "../contants/clickUpCustomFields";
import fillExcelTemplate from "../utils/fillExcelTemplate";
import { db } from "../index";

dayjs.extend(utc);
dayjs.locale("es");

type poLine = {
  skuId: string;
  numberOfBoxes: number;
}

type purchaseOrderRequest = {
  poLines: poLine[];
  orderNumber: string;
}

type createClickUpTaskBody = {
  name: string;
  status?: string;
  custom_fields?: Record<string, unknown>[];
}

export const purchaseOrder = onRequest(async (req, res) => {
  let action = "";
  try {

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    action = "Parsing request body";
    const poRequest = req.body as purchaseOrderRequest;

    action = "Fetching SKUs data from Firestore";
    const skuIds = poRequest.poLines.map(line => line.skuId);
    const skuData = await Promise.all(skuIds.map(async (skuId) => {
      const skuDoc = await db.collection("skus").doc(skuId).get();
      if (!skuDoc.exists) {
        res.status(400).send({ error: `SKU with ID ${skuId} does not exist` });
      }
      return skuDoc.data() as Sku;
    }));

    action = "Calculating total amount for purchase order";
    const totalAmountPurchaseOrder = skuData.reduce((total, sku, index) => {
      const line = poRequest.poLines[index];
      const lineTotal = sku.unitCost * sku.unitsPerBox * line.numberOfBoxes;
      return total + lineTotal;
    }, 0);

    action = "Creating ClickUp purchase order task";
    const bodyCFPurchaseOrder = [
      {
        id: PURCHASE_ORDERS_CF_IDS.INVOICE_AMOUNT,
        value: totalAmountPurchaseOrder
      },
      {
        id: PURCHASE_ORDERS_CF_IDS.CREATION_DATE,
        value: dayjs.utc().startOf("day").valueOf()
      }
    ];

    const createTaskBody: createClickUpTaskBody = {
      name: poRequest.orderNumber,
      custom_fields: bodyCFPurchaseOrder
    };

    action = "Sending create purchase order task request to ClickUp";
    const clickupPurcharseOrderTaskId = await createTask(
      process.env.CLICKUP_PURCHASE_ORDERS_LIST_ID as string,
      createTaskBody
    );

    const excelData: Record<string, string | number> = {
      I3: dayjs.utc().format("DD-MMM-YY")
        .replace(/^(\d{2}-)([a-z])/, (match, prefix, firstLetter) =>
          prefix + firstLetter.toUpperCase()
        ),
      I4: poRequest.orderNumber,
      K43: totalAmountPurchaseOrder
    }

    let excelCellRowNumber = 16;

    action = "Creating ClickUp purchase order line items";
    poRequest.poLines.forEach(async (line) => {
      const sku = skuData.find(s => s.skuId === line.skuId);
      if (!sku) return;

      excelData[`A${excelCellRowNumber}`] = sku.skuCodeForOrdering;
      excelData[`B${excelCellRowNumber}`] = sku.name;
      excelData[`E${excelCellRowNumber}`] = sku.thickness;
      excelData[`F${excelCellRowNumber}`] = sku.size;
      excelData[`G${excelCellRowNumber}`] = sku.finish;
      excelData[`H${excelCellRowNumber}`] = line.numberOfBoxes * sku.unitsPerBox;
      excelData[`I${excelCellRowNumber}`] = line.numberOfBoxes;
      excelData[`J${excelCellRowNumber}`] = sku.unitCost;
      excelData[`K${excelCellRowNumber}`] = sku.unitCost * sku.unitsPerBox * line.numberOfBoxes;

      excelCellRowNumber++;

      const bodyCFPoLines = [
        {
          id: PO_LINES_CF_IDS.CODE,
          value: poRequest.orderNumber
        },
        {
          id: PO_LINES_CF_IDS.QUANTITY,
          value: line.numberOfBoxes * sku.unitsPerBox
        },
        {
          id: PO_LINES_CF_IDS.BOXES,
          value: line.numberOfBoxes
        },
        {
          id: PO_LINES_CF_IDS.UNIT_COST,
          value: sku.unitCost
        },
        {
          id: PO_LINES_CF_IDS.CODE,
          value: sku.skuCodeForOrdering
        },
        {
          id: PO_LINES_CF_IDS.SIZE,
          value: sku.size
        },
        {
          id: PO_LINES_CF_IDS.THICKNESS,
          value: sku.thickness
        },
        {
          id: PO_LINES_CF_IDS.FINISH,
          value: sku.finish
        },
        {
          id: PO_LINES_CF_IDS.PURCHASE_ORDER_LINK,
          value: {
            add: [clickupPurcharseOrderTaskId]
          }
        }
      ];

      const createPoLineBody: createClickUpTaskBody = {
        name: sku.name,
        custom_fields: bodyCFPoLines
      };

      action = `Sending create purchase order line item for SKU ${sku.skuId} to ClickUp`;
      const taskId = await createTask(
        process.env.CLICKUP_PO_LINES_LIST_ID as string,
        createPoLineBody
      );

      action = "Creating OC analysis task"
      const bodyCFOcAnalysis = [
        {
          id: OC_ANALYSIS_CF_IDS.PURCHASE_ORDER_LINK,
          value: {
            add: [clickupPurcharseOrderTaskId]
          }
        },
        {
          id: OC_ANALYSIS_CF_IDS.QUANTITY,
          value: line.numberOfBoxes * sku.unitsPerBox
        },
        {
          id: OC_ANALYSIS_CF_IDS.PURCHASE_ORDER_CODE,
          value: poRequest.orderNumber
        },
        {
          id: OC_ANALYSIS_CF_IDS.UNIT_COST_SKU,
          value: sku.unitCost
        },
        {
          id: OC_ANALYSIS_CF_IDS.TOTAL_COST_SKU,
          value: sku.unitCost * sku.unitsPerBox * line.numberOfBoxes
        },
        {
          id: OC_ANALYSIS_CF_IDS.TOTAL_PURCHASE_ORDER,
          value: totalAmountPurchaseOrder
        },
        {
          id: OC_ANALYSIS_CF_IDS.SELLING_PRICE,
          value: sku.sellingPrice
        }
      ];

      const createOcAnalysisBody: createClickUpTaskBody = {
        name: sku.name,
        custom_fields: bodyCFOcAnalysis
      };

      action = "Sending create OC analysis task request to ClickUp";
      const clickupOcAnalysisTaskId = await createTask(
        process.env.CLICKUP_OC_ANALYSIS_LIST_ID as string,
        createOcAnalysisBody
      );
    });

    const buffer = await fillExcelTemplate(excelData);

    action = `Uploading purchase order Excel file to ClickUp`;
    await createTaskAttachment(
      clickupPurcharseOrderTaskId,
      {
        data: buffer,
        filename: `${poRequest.orderNumber}.xlsx`
      }
    );

    action = "Creating account payable task";
    const bodyCFAccountPayable = [
      {
        id: ACCOUNTS_PAYABLE_CF_IDS.INVOICE_AMOUNT,
        value: totalAmountPurchaseOrder
      },
      {
        id: ACCOUNTS_PAYABLE_CF_IDS.OUTSTANDING_AMOUNT,
        value: totalAmountPurchaseOrder
      },
      {
        id: ACCOUNTS_PAYABLE_CF_IDS.PAYED_AMOUNT,
        value: 0
      },
      {
        id: ACCOUNTS_PAYABLE_CF_IDS.PURCHASE_ORDER_LINK,
        value: {
          add: [clickupPurcharseOrderTaskId]
        }
      }
    ];

    action = "Sending create account payable task request to ClickUp";

    const createAccountPayableBody: createClickUpTaskBody = {
      name: poRequest.orderNumber,
      custom_fields: bodyCFAccountPayable
    };

    action = "Sending create account payable task request to ClickUp";
    const clickupAccountPayableTaskId = await createTask(
      process.env.CLICKUP_ACCOUNTS_PAYABLE_LIST_ID as string,
      createAccountPayableBody
    );

    action = "Creating logistics task";
    const bodyCFLogistics = [
      {
        id: LOGISTICS_CF_IDS.PURCHASE_ORDER_LINK,
        value: {
          add: [clickupPurcharseOrderTaskId]
        }
      }
    ];

    const createLogisticsBody: createClickUpTaskBody = {
      name: poRequest.orderNumber,
      custom_fields: bodyCFLogistics
    };

    action = "Sending create logistics task request to ClickUp";
    const clickupLogisticsTaskId = await createTask(
      process.env.CLICKUP_LOGISTICS_LIST_ID as string,
      createLogisticsBody
    );

    action = "Creating advance task";
    const bodyCFAdvance = [
      {
        id: ADVANCES_CF_IDS.PURCHASE_ORDER_LINK,
        value: {
          add: [clickupPurcharseOrderTaskId]
        }
      },
      {
        id: ADVANCES_CF_IDS.INVOICE_AMOUNT,
        value: totalAmountPurchaseOrder
      },
      {
        id: ADVANCES_CF_IDS.PURCHARSE_ORDER_NUMBER,
        value: poRequest.orderNumber
      }
    ];

    const createAdvanceBody: createClickUpTaskBody = {
      name: poRequest.orderNumber,
      custom_fields: bodyCFAdvance
    };

    action = "Sending create advance task request to ClickUp";
    const clickupAdvanceTaskId = await createTask(
      process.env.CLICKUP_ADVANCES_LIST_ID as string,
      createAdvanceBody
    );

    action = "Creating expense concept task";
    const bodyCFExpenseConcept = [
      {
        id: EXPENSE_CONCEPTS_CF_IDS.ADVANCES_LINK,
        value: {
          add: [clickupAdvanceTaskId]
        }
      }
    ];

    const createExpenseConceptBody: createClickUpTaskBody = {
      name: poRequest.orderNumber,
      custom_fields: bodyCFExpenseConcept
    };

    action = "Sending create expense concept task request to ClickUp";
    const clickupExpenseConceptTaskId = await createTaskFromTemplate(
      process.env.CLICKUP_EC_TASK_TEMPLATE_ID as string,
      process.env.CLICKUP_EXPENSE_CONCEPTS_LIST_ID as string,
      createExpenseConceptBody
    );

    action = "Updating next purchase order number";
    await db.collection("systemConfig").doc("main").update({
      "poNumbering.nextNumber": FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });

    res.status(201).send({
      purcharseOrderUrl: `https://app.clickup.com/t/${clickupPurcharseOrderTaskId}`
    });
  }
  catch (error: any) {
    console.error(`Error during action: ${action}`, error.message);
    res.status(500).send("Internal Server Error");
  }
});


