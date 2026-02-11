export const PURCHASE_ORDERS_CF_IDS = {
  CREATION_DATE: "c5a17726-0468-497f-88bd-db8a62e3ada4",
  INVOICE_AMOUNT: "e50d5461-2346-42cb-9400-ef16e8ea0574",
  SKUS_LINK: "8a5ffa69-bfeb-4854-b0fa-233f461c8f6f",
  ACCOUNTS_PAYABLE_LINK: "23e3711b-7c7f-4d54-8709-c500961f44bc",
  LOGISTICS_LINK: "92c29882-078c-4099-869b-b0b75843c192",
  ADVANCES_LINK: "fa00675e-cd88-4784-8af4-c289bf1444f2",
}

export const PO_LINES_CF_IDS = {
  CODE: "24913788-1f3d-49b6-a902-35609b4068ac",
  SIZE: "5280d2cd-e0d0-4e71-8550-b1058c69edb1",
  THICKNESS: "625b7d09-cbbc-4baa-bc74-3eb40cf4841a",
  QUANTITY: "747f1224-f299-4083-a4e7-fdceb24cb347",
  BOXES: "7485b22c-2196-43be-a246-76edd2863b62",
  FINISH: "7b2e9c45-0a52-455d-b182-3087e3244003",
  TOTAL: "c53dd26d-c1d0-4771-9be3-42bc9843cf7e",
  UNIT_COST: "c558317a-33df-4884-931e-4c28942590c8",
  PURCHASE_ORDER_LINK: "8a5ffa69-bfeb-4854-b0fa-233f461c8f6f",
}

export const ACCOUNTS_PAYABLE_CF_IDS = {
  INVOICE_AMOUNT: "e50d5461-2346-42cb-9400-ef16e8ea0574",
  OUTSTANDING_AMOUNT: "d8164ed4-9c9b-4779-985d-a7efa8dd781f",
  PAYED_AMOUNT: "0e2849b4-09ad-434b-a5f4-844cc1935f1b",
  CURRENCY: "2f4ffa85-ec77-4e05-82a0-8d83a93ff436",
  DUE_DATE: "7edf5896-3348-4711-8e11-07ce71f5fcc4",
  SUPPLIER: "e86edccc-5939-4082-80b8-8f2b4cfd2290",
  INVOICE: "ffc34f73-314b-4605-87ba-ff632ee5ad62",
  PAYMENT_RECEIPT: "2c5492ba-d456-4eda-a148-6addbfd75a79",
  PURCHASE_ORDER_LINK: "23e3711b-7c7f-4d54-8709-c500961f44bc",
}

export const LOGISTICS_CF_IDS = {
  PURCHASE_ORDER_LINK: "92c29882-078c-4099-869b-b0b75843c192",
}

export const ADVANCES_CF_IDS = {
  INVOICE_AMOUNT: "e50d5461-2346-42cb-9400-ef16e8ea0574",
  PURCHARSE_ORDER_NUMBER: "b04b0bda-2735-4cbc-8c82-de19ecdfef81",
  EXPENSE_CONCEPT_LINK: "24bb11f9-d346-4054-af6d-09ec83b181c5",  
  PURCHASE_ORDER_LINK: "fa00675e-cd88-4784-8af4-c289bf1444f2",
}

export const EXPENSE_CONCEPTS_CF_IDS = {
  ADVANCES_LINK: "24bb11f9-d346-4054-af6d-09ec83b181c5",
}

const oc_analysis_example = {
    "fields": [
        {
            "id": "42460b12-d234-4876-bc70-8b68905d3091",
            "name": "Nacionalización x SKU",
            "type": "formula",
            "type_config": {
                "simple": false,
                "formula": "ROUNDDOWN((CUSTOM_FIELD_6e3599a3_c809_45f9_8a69_3affbfa3d2df/CUSTOM_FIELD_a9ac7540_030b_4eb2_ad3e_42b9cf5d12ba)*CUSTOM_FIELD_c558317a_33df_4884_931e_4c28942590c8,2)",
                "version": "1.12",
                "is_dynamic": false,
                "return_types": [
                    "number"
                ],
                "calculation_state": "ready"
            },
            "date_created": "1769433471612",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "46febdd4-bd60-44fe-b719-d696d8e32a89",
            "name": "Gastos + Comisiones + Sueldo",
            "type": "formula",
            "type_config": {
                "simple": false,
                "formula": "(CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda*0.1)+(CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda*0.03)+(CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda*0.03)",
                "version": "1.12",
                "is_dynamic": false,
                "return_types": [
                    "number"
                ],
                "calculation_state": "ready"
            },
            "date_created": "1769457931184",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "536b92f7-06c7-4200-99ca-1c29a02a295d",
            "name": "Costo total SKU",
            "type": "formula",
            "type_config": {
                "simple": false,
                "formula": "ROUNDDOWN(CUSTOM_FIELD_c558317a_33df_4884_931e_4c28942590c8+(CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda*0.1)+(CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda*0.03)+(CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda*0.03)+((CUSTOM_FIELD_6e3599a3_c809_45f9_8a69_3affbfa3d2df/CUSTOM_FIELD_a9ac7540_030b_4eb2_ad3e_42b9cf5d12ba)*CUSTOM_FIELD_c558317a_33df_4884_931e_4c28942590c8)+((CUSTOM_FIELD_b7986dfe_f242_44de_95ee_ddb6d4ed50bc/CUSTOM_FIELD_a9ac7540_030b_4eb2_ad3e_42b9cf5d12ba)*CUSTOM_FIELD_c558317a_33df_4884_931e_4c28942590c8),2)",
                "version": "1.12",
                "is_dynamic": false,
                "return_types": [
                    "number"
                ],
                "calculation_state": "ready"
            },
            "date_created": "1770729812977",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "5f06c74e-064a-410b-a51a-8381308d75d0",
            "name": "Órden de compra",
            "type": "list_relationship",
            "type_config": {
                "fields": [],
                "subcategory_id": "901322922995",
                "subcategory_inverted_name": "Órdenes de Compra"
            },
            "date_created": "1770728249140",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "6e3599a3-c809-45f9-8a69-3affbfa3d2df",
            "name": "Nacionalización",
            "type": "number",
            "type_config": {},
            "date_created": "1769433241230",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "723fad06-44ab-4096-a816-6a70fda46d13",
            "name": "Código OC",
            "type": "short_text",
            "type_config": {},
            "date_created": "1769178406988",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "747f1224-f299-4083-a4e7-fdceb24cb347",
            "name": "Cantidad",
            "type": "number",
            "type_config": {},
            "date_created": "1765886596181",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "93bba928-9b57-498f-b053-017cca113ef7",
            "name": "Flete x SKU",
            "type": "formula",
            "type_config": {
                "simple": false,
                "formula": "ROUNDDOWN((CUSTOM_FIELD_b7986dfe_f242_44de_95ee_ddb6d4ed50bc/CUSTOM_FIELD_a9ac7540_030b_4eb2_ad3e_42b9cf5d12ba)*CUSTOM_FIELD_c558317a_33df_4884_931e_4c28942590c8,2)",
                "version": "1.12",
                "is_dynamic": false,
                "return_types": [
                    "number"
                ],
                "calculation_state": "ready"
            },
            "date_created": "1769433801770",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "9bba05fc-6a08-4e89-a1e1-65a6fdd331bf",
            "name": "Ganancia",
            "type": "formula",
            "type_config": {
                "simple": false,
                "formula": "CONCATENATE(ROUNDDOWN(((CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda-CUSTOM_FIELD_536b92f7_06c7_4200_99ca_1c29a02a295d)/CUSTOM_FIELD_f4a8ecd9_6374_4703_a5d3_0adabb3c6fda)*100,2),\"%\")",
                "version": "1.12",
                "is_dynamic": false,
                "return_types": [
                    "string"
                ],
                "calculation_state": "ready"
            },
            "date_created": "1770730185726",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "a9ac7540-030b-4eb2-ad3e-42b9cf5d12ba",
            "name": "Total OC",
            "type": "number",
            "type_config": {},
            "date_created": "1769433330048",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "b7986dfe-f242-44de-95ee-ddb6d4ed50bc",
            "name": "Flete",
            "type": "number",
            "type_config": {},
            "date_created": "1769433199963",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "c558317a-33df-4884-931e-4c28942590c8",
            "name": "Costo Unitario SKU",
            "type": "number",
            "type_config": {},
            "date_created": "1765886628212",
            "hide_from_guests": false,
            "required": false
        },
        {
            "id": "f4a8ecd9-6374-4703-a5d3-0adabb3c6fda",
            "name": "Precio de venta",
            "type": "number",
            "type_config": {},
            "date_created": "1769457801954",
            "hide_from_guests": false,
            "required": false
        }
    ]
}


export const OC_ANALYSIS_CF_IDS = {
  NATIONALIZATION_PER_SKU: "42460b12-d234-4876-bc70-8b68905d3091",
  GAINS_COMMISSIONS_SALARY: "46febdd4-bd60-44fe-b719-d696d8e32a89",
  TOTAL_COST_SKU: "536b92f7-06c7-4200-99ca-1c29a02a295d",
  NATIONALIZATION: "6e3599a3-c809-45f9-8a69-3affbfa3d2df",
  PURCHASE_ORDER_CODE: "723fad06-44ab-4096-a816-6a70fda46d13",
  QUANTITY: "747f1224-f299-4083-a4e7-fdceb24cb347",
  FREIGHT_PER_SKU: "93bba928-9b57-498f-b053-017cca113ef7",
  PROFIT: "9bba05fc-6a08-4e89-a1e1-65a6fdd331bf",
  TOTAL_PURCHASE_ORDER: "a9ac7540-030b-4eb2-ad3e-42b9cf5d12ba",
  FREIGHT: "b7986dfe-f242-44de-95ee-ddb6d4ed50bc",
  UNIT_COST_SKU: "c558317a-33df-4884-931e-4c28942590c8",
  SELLING_PRICE: "f4a8ecd9-6374-4703-a5d3-0adabb3c6fda",
  PURCHASE_ORDER_LINK: "5f06c74e-064a-410b-a51a-8381308d75d0",
}





