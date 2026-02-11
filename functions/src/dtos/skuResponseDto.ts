export interface SkuResponseDto {
    skuId: string;
    skuCodeForOrdering: string;
    name: string;
    size: string;
    thickness: string;
    finish: string;
    type: string;
    unitCost: number;
    unitsPerBox: number;
    currentStock: number;
    breakpoint: number;
    monthsCoverage: number;
    avgMonthlySales: number;
}