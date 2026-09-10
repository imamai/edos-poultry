// Hand-maintained types for this app's slice of the shared edos_db database
// (poultryedos_ prefixed tables only). edos_db hosts several unrelated
// products; we do not generate types for its full schema here.

export type TenantStatus = "onboarding" | "active" | "suspended" | "cancelled";
export type MembershipRole =
  | "owner"
  | "admin"
  | "farm_manager"
  | "field_officer"
  | "farmer"
  | "veterinary_officer";
export type FlockStatus = "active" | "sold_out" | "closed";
export type TicketPriority = "low" | "medium" | "high";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type KnowledgeCategory =
  | "brooding"
  | "feeding"
  | "vaccination"
  | "biosecurity"
  | "housing"
  | "egg_handling"
  | "disease_warning_signs"
  | "marketing"
  | "record_keeping"
  | "profitability"
  | "water_management"
  | "welfare";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  timezone: string;
  currency: string;
  locale: string;
  contact_email: string | null;
  contact_phone: string | null;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MembershipRole;
  status: "invited" | "active" | "suspended";
}

export interface PoultryType {
  id: string;
  tenant_id: string | null;
  name: string;
  code: string;
  is_active: boolean;
}

export interface Farmer {
  id: string;
  tenant_id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  county: string | null;
  sub_county: string | null;
  ward: string | null;
  experience_level: "new" | "experienced" | "expert";
  is_active: boolean;
}

export interface Farm {
  id: string;
  tenant_id: string;
  farmer_id: string;
  name: string;
  county: string | null;
  sub_county: string | null;
  ward: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  water_source: string | null;
  has_electricity: boolean | null;
  notes: string | null;
  is_active: boolean;
}

export interface House {
  id: string;
  tenant_id: string;
  farm_id: string;
  name: string;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
}

export interface Flock {
  id: string;
  tenant_id: string;
  farm_id: string;
  house_id: string | null;
  poultry_type_id: string | null;
  batch_code: string;
  breed: string | null;
  source: string | null;
  supplier: string | null;
  placement_date: string;
  initial_quantity: number;
  current_quantity: number;
  status: FlockStatus;
  created_at: string;
}

export interface DailyRecord {
  id: string;
  tenant_id: string;
  flock_id: string;
  record_date: string;
  mortality: number;
  culls: number;
  birds_sold: number;
  eggs_collected: number | null;
  feed_consumed_kg: number | null;
  water_consumed_liters: number | null;
  sales_amount_cents: number;
  notes: string | null;
  created_at: string;
}

export interface VaccinationSchedule {
  id: string;
  tenant_id: string;
  flock_id: string;
  vaccine_name: string;
  target_disease: string | null;
  scheduled_date: string;
  age_days: number | null;
  administered_date: string | null;
  notes: string | null;
}

export type MedicationType = "antibiotic" | "multivitamin" | "dewormer" | "other";

export interface MedicationRecord {
  id: string;
  tenant_id: string;
  flock_id: string;
  medication_type: MedicationType;
  medication_name: string;
  dosage: string | null;
  given_date: string;
  notes: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  tenant_id: string;
  farmer_id: string;
  flock_id: string | null;
  problem: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
}

export interface KnowledgeArticle {
  id: string;
  tenant_id: string | null;
  title: string;
  category: KnowledgeCategory;
  poultry_type_scope: string | null;
  body: string;
}

export interface HealthEvent {
  id: string;
  tenant_id: string;
  flock_id: string;
  event_date: string;
  symptoms: string | null;
  suspected_condition: string | null;
  treatment: string | null;
  medication: string | null;
  veterinarian: string | null;
  follow_up_date: string | null;
  resolved: boolean;
  notes: string | null;
  created_at: string;
}

export interface BiosecurityCheck {
  id: string;
  tenant_id: string;
  farm_id: string;
  check_date: string;
  footbath: boolean;
  visitor_control: boolean;
  ppe_used: boolean;
  cleaning_done: boolean;
  disinfection_done: boolean;
  rodent_control: boolean;
  dead_bird_disposal: boolean;
  feed_hygiene: boolean;
  water_sanitation: boolean;
  notes: string | null;
}

export interface ExpenseCategory {
  id: string;
  tenant_id: string | null;
  name: string;
  is_active: boolean;
}

export interface Expense {
  id: string;
  tenant_id: string;
  category_id: string | null;
  flock_id: string | null;
  amount_cents: number;
  expense_date: string;
  description: string | null;
  created_at: string;
}

export type CustomerType =
  | "hotel"
  | "restaurant"
  | "school"
  | "hospital"
  | "supermarket"
  | "wholesaler"
  | "retailer"
  | "individual"
  | "aggregator"
  | "processor";

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  customer_type: CustomerType;
  notes: string | null;
  is_active: boolean;
}

export type SaleProduct = "eggs" | "live_birds" | "processed_birds" | "spent_layers" | "chicks" | "manure" | "other";
export type PaymentMethod = "cash" | "mpesa" | "bank" | "credit" | "other";

export interface Sale {
  id: string;
  tenant_id: string;
  flock_id: string | null;
  customer_id: string | null;
  product: SaleProduct;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  total_amount_cents: number;
  payment_method: PaymentMethod;
  sale_date: string;
  notes: string | null;
  created_at: string;
}

export type InventoryCategory = "feed" | "vaccine" | "medicine" | "equipment" | "other";

export interface InventoryItem {
  id: string;
  tenant_id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  stock_on_hand: number;
  reorder_level: number | null;
  is_active: boolean;
}

export type InventoryTransactionType = "in" | "out" | "adjustment";

export interface InventoryTransaction {
  id: string;
  tenant_id: string;
  item_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  unit_cost_cents: number | null;
  reference: string | null;
  transaction_date: string;
  notes: string | null;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
}

export type PurchaseOrderStatus = "ordered" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplier_id: string | null;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_cost_cents: number;
  total_cost_cents: number;
  order_date: string;
  received_date: string | null;
  status: PurchaseOrderStatus;
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface FarmerInvite {
  id: string;
  tenant_id: string;
  farmer_id: string;
  email: string;
  token: string;
  status: InviteStatus;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
}

export interface FieldAssignment {
  id: string;
  tenant_id: string;
  field_officer_user_id: string;
  farmer_id: string;
  created_at: string;
}

export type FieldVisitStatus =
  | "assigned"
  | "traveling"
  | "visited"
  | "assessment"
  | "recommendation"
  | "action_required"
  | "follow_up"
  | "resolved";

export interface FieldVisit {
  id: string;
  tenant_id: string;
  field_officer_user_id: string;
  farmer_id: string;
  farm_id: string | null;
  status: FieldVisitStatus;
  scheduled_date: string;
  visited_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  assessment: string | null;
  recommendation: string | null;
  notes: string | null;
}

export interface FieldTask {
  id: string;
  tenant_id: string;
  assigned_to: string | null;
  farmer_id: string | null;
  visit_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "open" | "done";
  created_at: string;
}
