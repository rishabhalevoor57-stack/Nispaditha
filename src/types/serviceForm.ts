export type ServiceFormStatus = 'received' | 'in_progress' | 'ready' | 'completed';

export const SERVICE_FORM_STATUS_LABELS: Record<ServiceFormStatus, string> = {
  received: 'Received',
  in_progress: 'In Progress',
  ready: 'Ready',
  completed: 'Completed',
};

export const SERVICE_FORM_STATUS_COLORS: Record<ServiceFormStatus, string> = {
  received: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export const SERVICE_TYPE_OPTIONS = [
  'Polish',
  'Repair',
  'Resize',
  'Fix Clasp',
  'Stone Setting / Stone Replacement',
  'Cleaning',
  'Rhodium Plating',
  'Labour',
  'Stock',
  'Metal',
  'Restringing',
  'Jewellery Restringing',
  'Pearl Restringing',
  'Bead Restringing',
  'Mala Restringing',
] as const;

export interface ServiceForm {
  id: string;
  receipt_number: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  item_description: string;
  from_our_shop: boolean;
  original_invoice_no: string | null;
  material: string | null;
  weight_grams: number;
  condition_on_receipt: string | null;
  photo_url: string | null;
  service_types: string[];
  other_service_text: string | null;
  service_notes: string | null;
  estimated_delivery_date: string | null;
  estimated_cost: number;
  final_cost: number;
  status: ServiceFormStatus;
  completed_invoice_id: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
