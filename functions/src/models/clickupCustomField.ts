export interface DropDownOption {
  id: string;
  name: string;
  color: string;
  orderindex: number;
}
export interface TypeConfig {
  // Para Dropdown
  sorting?: string;
  options?: DropDownOption[];
  
  // Para Formula
  simple?: boolean;
  formula?: string;
  version?: string;
  is_dynamic?: boolean;
  return_types?: string[];
  calculation_state?: string;
  [key: string]: any; 
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
  type_config: TypeConfig;
  date_created: string; // Viene como string numérico (timestamp)
  hide_from_guests: boolean;
  required: boolean;
}