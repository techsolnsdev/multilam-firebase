// src/services/clickupClient.ts
import axios from "axios";
import { CustomField } from "../models/clickupCustomField";
import ExcelJS from "exceljs";

export const clickupApi = axios.create({
  baseURL: "https://api.clickup.com/api/v2/",
  headers: {
    "Authorization": process.env.CLICKUP_API_KEY,
    "Content-Type": "application/json"
  }
});

export const getTask = async (taskId: string) => {
  try {
    const response = await clickupApi.get(`task/${taskId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching task details from ClickUp:", error);
    throw error;
  }
};

export const createTask = async (
  listId: string,
  taskData: Record<string, unknown>,
  excelFile?: { data: ExcelJS.Buffer; filename?: string }
) => {
  try {
    const response = await clickupApi.post(`list/${listId}/task`, taskData);
    const task = response.data;

    if (excelFile && excelFile.data) {
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("attachment", excelFile.data, excelFile.filename ?? "file.xlsx");

      await clickupApi.post(`task/${task.id}/attachment`, form, {
        headers: {
          ...form.getHeaders()
        }
      });
    }

    return task.id as string;
  } catch (error) {
    console.error("Error creating task in ClickUp:", error);
    throw error;
  }
};

export const setCustomField = async (
  taskId: string,
  fieldId: string,
  value: unknown
) => {
  try {
    const body = {
      value: value
    };
    await clickupApi.post(`task/${taskId}/field/${fieldId}`, body);
  } catch (error) {
    console.error(`Error setting custom field ${fieldId} for task ${taskId}:`, error);
    throw error;
  }
};

export const getCustomFields = async (listId: string) => {
  try {
    const response = await clickupApi.get(`list/${listId}/field`);
    return response.data.fields as CustomField[];
  } catch (error) {
    console.error("Error fetching custom fields from ClickUp:", error);
    throw error;
  }
};

export const createTaskAttachment = async (
  taskId: string,
  excelFile: { data: ExcelJS.Buffer; filename?: string }
) => {
  try {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("attachment", excelFile.data, excelFile.filename ?? "file.xlsx");

    await clickupApi.post(`task/${taskId}/attachment`, form, {
      headers: {
        ...form.getHeaders()
      }
    });
  } catch (error) {
    console.error("Error creating task attachment in ClickUp:", error);
    throw error;
  }
};


export const createTaskFromTemplate = async (
  templateId: string,
  listId: string,
  taskData: Record<string, unknown>
) => {
  try {
    const response = await clickupApi.post(`list/${listId}/taskTemplate/${templateId}`, taskData);
    const task = response.data;
    return task.id as string;
  } catch (error) {
    console.error("Error creating task from template in ClickUp:", error);
    throw error;
  }
};