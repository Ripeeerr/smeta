export type Role = "employee" | "manager" | "buyer" | "admin";
export type Status =
  | "draft"
  | "pending"
  | "returned"
  | "approved"
  | "ordered"
  | "received"
  | "rejected"
  | "cancelled";
export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  role_label: string;
  department: number | null;
  department_name: string | null;
}
export interface Session {
  user: User | null;
  csrf_token: string;
}
export interface Department {
  id: number;
  name: string;
}
export interface Budget {
  id: number;
  department: number;
  department_name: string;
  month: string;
  limit: string;
  spent: string;
  reserved: string;
  available: string;
}
export interface Supplier {
  id: number;
  name: string;
  tax_id: string;
  contact: string;
  email: string;
  phone: string;
  notes: string;
}
export interface Item {
  id: number;
  name: string;
  quantity: number;
  unit_price: string;
  received_quantity: number;
  total: string;
}
export interface Quote {
  id: number;
  supplier: number;
  supplier_name: string;
  amount: string;
  delivery_days: number;
  notes: string;
}
export interface Event {
  id: number;
  actor_name: string;
  action: string;
  comment: string;
  created_at: string;
}
export interface Attachment {
  id: number;
  original_name: string;
  size: number;
  created_at: string;
}
export interface Purchase {
  id: number;
  amount: string;
  supplier_name: string;
  expected_on: string;
  created_at: string;
}
export interface Requisition {
  id: number;
  number: string;
  title: string;
  description: string;
  author: number;
  author_name: string;
  department: number;
  department_name: string;
  needed_by: string;
  status: Status;
  status_label: string;
  total: string;
  approved_amount: string;
  items: Item[];
  quotes: Quote[];
  events: Event[];
  attachments: Attachment[];
  purchase: Purchase | null;
  created_at: string;
  updated_at: string;
}
export interface Overview {
  month: string;
  totals: { limit: number; spent: number; reserved: number; available: number };
  budgets: Budget[];
  pending: Requisition[];
  events: Event[];
  counts: Record<Status, number>;
}
