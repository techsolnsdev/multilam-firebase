import ExcelJS from "exceljs";
import path from 'path';

const filePath = path.join(process.cwd(), "src/templates/PO_TEMPLATE.xlsx");
const hoja = "ORDEN";

async function fillExcelTemplate(data: Record<string, string | number>): Promise<ExcelJS.Buffer> {

  const workbook = new ExcelJS.Workbook();

  try {
    // Leer el archivo de Excel
    await workbook.xlsx.readFile(filePath);

    // Seleccionar la hoja
    const worksheet = workbook.getWorksheet(hoja);
    if (!worksheet) {
      throw new Error(`La hoja "${hoja}" no existe en el archivo: ${filePath}`);
    }

    // Rellenar la hoja con los datos proporcionados
    for (const cell in data) {
      if (Object.prototype.hasOwnProperty.call(data, cell)) {
        const value = data[cell];
        worksheet.getCell(cell).value = value as any;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;

  } catch (error) {
    console.error("Error al procesar el archivo:", error);
    throw error;
  }
}

export default fillExcelTemplate;