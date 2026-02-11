import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Inicializamos la SDK una sola vez aquí
initializeApp();

export const db = getFirestore("production");

// Exportamos la función desde el archivo donde la creaste
// NOTA: Si usas NodeNext, recuerda el .js al final del path
export { init } from "./handlers/init";
export { inventory } from "./handlers/clickup/inventory";
export { loadSkus } from "./handlers/clickup/loadSkus";
//export { recalculate } from "./handlers/clickup/recalculate";
export { skus } from "./handlers/skus";
export { purchaseOrder } from "./handlers/purchaseOrder";