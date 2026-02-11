export interface ClickupWebhook {
    event: string;
    task_id: string;
    team_id: string;
    webhook_id: string;
    history_items: HistoryItem[];
}

export interface HistoryItem {
    id: string;
    type: number;
    date: string;
    field: string;
    parent_id: string;
    data: Data;
    source: any;
    user: User;
    before: any;
    after: any;
    custom_field: CustomField;
}

export interface CustomField {
    id: string;
    name: string;
    type: string;
    type_config: TypeConfig;
    values_set: any;
    userid: string;
    description: string;
    date_created: string;
    hide_from_guests: boolean;
    team_id: string;
    deleted: boolean;
    deleted_by: any;
    pinned: boolean;
    required: boolean;
    private: boolean;
    required_on_subtasks: boolean;
    linked_subcategory: any;
    permission_level: any;
    default_value: any;
    type_id: number;
    automation_count: number;
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

export interface Data {
    cf_type: number;
    createTask: boolean;
}

export interface User {
    id: number;
    username: string;
    email: string;
    color: string;
    initials: string;
    profilePicture: any;
    role: number;
    role_subtype: number;
}