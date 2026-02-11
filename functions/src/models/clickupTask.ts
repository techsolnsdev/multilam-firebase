export interface ClickupTask {
  id: string;
  custom_id: string | null;
  custom_item_id: number;
  name: string;
  text_content: string;
  description: string;
  status: Status;
  orderindex: string;
  date_created: string;
  date_updated: string;
  date_closed: string | null;
  date_done: string | null;
  archived: boolean;
  creator: Creator;
  assignees: any[];
  group_assignees: any[];
  watchers: Watcher[];
  checklists: any[];
  tags: any[];
  parent: string | null;
  top_level_parent: string | null;
  priority: string | null;
  due_date: string | null;
  start_date: string | null;
  points: number | null;
  time_estimate: number | null;
  time_spent: number;
  custom_fields: CustomField[];
  dependencies: any[];
  linked_tasks: any[];
  locations: any[];
  team_id: string;
  url: string;
  sharing: Sharing;
  permission_level: string;
  list: ParentContainer;
  project: ParentContainer;
  folder: ParentContainer;
  space: Space;
  attachments: any[];
}

export interface Status {
  id: string;
  status: string;
  color: string;
  orderindex: number;
  type: string;
}

export interface Creator {
  id: number;
  username: string;
  color: string;
  email: string;
  profilePicture: string | null;
}

export interface Watcher {
  id: number;
  username: string;
  color: string;
  initials: string;
  email: string;
  profilePicture: string | null;
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
  type_config: TypeConfig;
  date_created: string;
  hide_from_guests: boolean;
  value?: string | number;
  value_richtext?: string | null;
  required: boolean;
}

export interface TypeConfig {
  fields?: any[];
  subcategory_id?: string;
  linked_subcategory_access?: boolean;
  subcategory_inverted_name?: string;
  simple?: boolean;
  formula?: string;
  version?: string;
  reset_at?: number;
  is_dynamic?: boolean;
  return_types?: string[];
  calculation_state?: string;
  sorting?: string;
  options?: DropDownOption[];
}

export interface DropDownOption {
  id: string;
  name: string;
  color: string;
  orderindex: number;
}

export interface Sharing {
  public: boolean;
  public_share_expires_on: string | null;
  public_fields: string[];
  token: string | null;
  seo_optimized: boolean;
}

export interface ParentContainer {
  id: string;
  name: string;
  access: boolean;
  hidden?: boolean;
}

export interface Space {
  id: string;
}