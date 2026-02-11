import { onRequest } from "firebase-functions/v2/https";
import { Sku } from "../models/sku";
import { SkuResponseDto } from "../dtos/skuResponseDto";
import { db } from "../index";

export const skus = onRequest(async (req, res) => {
  let action = "";
  try {
    if (req.method !== "GET") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    action = "Fetching active SKUs from Firestore";
    const skus = await db.collection("skus").where("isActive", "==", true).orderBy("currentStock", "asc").get();

    if (skus.empty) {
      res.status(404).send({ error: "No active SKUs" });
      return;
    }

    action = "Mapping SKUs to response DTO";
    const response = skus.docs.map(doc => {
      const skuData = doc.data() as Sku

      const skuResponse: SkuResponseDto = {
        skuId: skuData.skuId,
        skuCodeForOrdering: skuData.skuCodeForOrdering,
        name: skuData.name,
        size: skuData.size,
        thickness: skuData.thickness,
        finish: skuData.finish,
        type: skuData.type,
        unitCost: skuData.unitCost,
        unitsPerBox: skuData.unitsPerBox,
        currentStock: skuData.currentStock,
        breakpoint: skuData.breakpoint,
        monthsCoverage: skuData.monthsCoverage,
        avgMonthlySales: skuData.avgMonthlySales,
      };

      return skuResponse;
    });

    res.status(200).send(response);
  } catch (error) {
    console.error(`Error during action: ${action}`, error);
    res.status(500).send("Internal Server Error");
  }
});