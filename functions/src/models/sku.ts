export interface Sku {
  skuId: string;
  skuCode: string;
  skuCodeForOrdering: string;
  name: string;
  size: string;
  thickness: string;
  finish: string;
  type: string;
  unitCost: number;
  unitsPerBox: number;
  currentStock: number;
  transitStock: number;
  breakpoint: number;
  monthsCoverage: number;
  avgMonthlySales: number;
  sellingPrice: number;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}