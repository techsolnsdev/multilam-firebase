export interface SystemConfig {
  clickUp: {
    workspaceId: string;
    spaceId: string;
    listIds: {
      inventory: string;
      purshaseOrders: string;
      poLines: string;
      accountsPayable: string;
      logistics: string;
    };
    apiKey: string;
  }
  poNumbering: {
    prefix: string;
    nextNumber: number;
    paddingLength: number;
  };
  skuTypes: string[];
  updatedAt: Date | any;
}