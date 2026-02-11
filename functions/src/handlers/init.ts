import { onRequest } from "firebase-functions/v2/https";
import { SystemConfig } from "../models/systemConfig";
import { SystemConfigResponseDto } from "../dtos/systemConfigResponseDto";
import dayjs from "dayjs";
import { db } from "../index";

export const init = onRequest(async (req, res) => {
  let action = "";
  try {

    if (req.method !== "GET") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    action = "Fetching system configuration from Firestore";
    const configSnap = await db.collection("systemConfig").doc("main").get();

    if (!configSnap.exists) {
      res.status(404).send({ error: "No configuration found" });
      return;
    }

    action = "Parsing system configuration data";
    const data = configSnap.data() as SystemConfig;

    action = "Mapping data to response DTO";
    const response: SystemConfigResponseDto = {
      orderNumber: `${data.poNumbering.prefix}${dayjs().format("YY")}-${data.poNumbering.nextNumber.toString()}`,
      skuTypes: data.skuTypes || [],
    };

    res.status(200).send(response);
  } catch (error) {
    console.error(`Error during action: ${action}`, error);
    res.status(500).send("Internal Server Error");
  }
});