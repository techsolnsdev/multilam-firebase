import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Busboy from "busboy";
import csv from "csv-parser";
import iconv from "iconv-lite";
import { Sku } from "../../models/sku";
import { db } from "../../index";

export const loadSkus = onRequest(async (req, res) => {

  let action = "";

  try {

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    action = "Initializing Busboy";
    const busboy = Busboy({ headers: req.headers });

    action = "Getting SKUs collection";
    const collection = db.collection("skus");

    action = "Initializing batch";
    let batch = db.batch();
    let batchCount = 0;
    const commits: Promise<any>[] = [];
    let fileProcessed = false;

    action = "Processing upload";
    const processUpload = () => new Promise((resolve, reject) => {

      busboy.on("file", (fieldname, file) => {
        fileProcessed = true;

        file
          .pipe(iconv.decodeStream("utf8"))
          .pipe(csv())
          .on("data", (row: any) => {

            const clickupId = row["Task ID"];

            if (!clickupId) {
              console.warn("Fila sin Task ID, omitiendo:", row);
              return;
            }

            action = "Mapping SKUs to Sku model";
            const item: Sku = {
              skuId: clickupId,
              name: row["Task Name"] || "",
              status: row["Status"] || "",
              finish: row["Acabado (short text)"] || "",
              unitsPerBox: parseInt(row["Cajones (number)"]) || 0,
              unitCost: parseFloat(row["Costo Unitario SKU (number)"]) || 0,
              skuCode: row["Código (short text)"] || "",
              skuCodeForOrdering: row["Código OC (short text)"] || "",
              thickness: row["Espesor (short text)"] || "",
              currentStock: parseInt(row["Inventario actual (number)"]) || 0,
              transitStock: parseInt(row["Inventario en tránsito (number)"]) || 0,
              monthsCoverage: parseFloat(row["Meses cobertura (number)"]) || 0,
              sellingPrice: parseFloat(row["Precio venta (number)"]) || 0,
              avgMonthlySales: parseFloat(row["Promedio venta mensual (formula)"]) || 0,
              breakpoint: parseInt(row["Punto de quiebre (number)"]) || 0,
              size: row["Tamaño (short text)"] || "",
              type: row["Tipo (drop down)"] || "",
              isActive: row["Status"] === "activo",
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            action = "Setting SKU in batch";
            const docRef = collection.doc(clickupId);
            batch.set(docRef, item);
            batchCount++;

            if (batchCount >= 500) {
              action = "Committing batch";
              commits.push(batch.commit());
              batch = db.batch();
              batchCount = 0;
            }
          })
          .on("end", () => {
            console.log("CSV stream finished");
          })
          .on("error", reject);
      });

      busboy.on("finish", async () => {
        if (!fileProcessed) {
          return reject(new Error("No file uploaded"));
        }

        try {
          action = "Committing last batch";
          if (batchCount > 0) commits.push(batch.commit());

          action = "Waiting for all commits to complete";
          await Promise.all(commits);
          resolve("Success");
        } catch (err) {
          reject(err);
        }
      });

      busboy.on("error", reject);

      busboy.end(req.rawBody);
    });

    await processUpload();
    res.status(201).send();
  } catch (error: any) {
    console.error(`Error during action: ${action}`, error);
    res.status(500).send("Internal Server Error");
  }
});