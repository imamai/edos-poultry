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
/** A real payment against a sale is never made "on credit" -- credit is
 * the absence of a payment, not a way of making one (migration 0030). */
export type ActualPaymentMethod = "cash" | "mpesa" | "bank" | "other";

/** As of migration 0030, a sale is a header + one or more poultryedos_sale_items
 * -- total_amount_cents is trigger-maintained from those items, and
 * product/quantity/unit/unit_price_cents no longer live here. */
export interface Sale {
  id: string;
  tenant_id: string;
  flock_id: string | null;
  customer_id: string | null;
  total_amount_cents: number;
  payment_method: PaymentMethod;
  sale_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  tenant_id: string;
  sale_id: string;
  product: SaleProduct;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  sale_id: string;
  amount_cents: number;
  method: ActualPaymentMethod;
  paid_at: string;
  recorded_by: string | null;
  created_at: string;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "converted";

export interface Quotation {
  id: string;
  tenant_id: string;
  farm_id: string;
  customer_id: string | null;
  prospect_name: string | null;
  prospect_phone: string | null;
  valid_until: string | null;
  status: QuotationStatus;
  notes: string | null;
  total_amount_cents: number;
  converted_sale_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface QuotationItem {
  id: string;
  tenant_id: string;
  quotation_id: string;
  product: SaleProduct;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
  created_at: string;
}

/** A cart line as sent to poultryedos_create_sale/create_quotation's
 * p_items jsonb argument. */
export interface CartLine {
  product: SaleProduct;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  discount_cents: number;
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

/** Header only — line items live in poultryedos_purchase_order_items
 * (spec §32). total_cost_cents is trigger-maintained, summed from those
 * lines, the same "the app never computes a derived value by hand"
 * pattern as poultryedos_flocks.current_quantity. */
export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplier_id: string | null;
  total_cost_cents: number;
  order_date: string;
  received_date: string | null;
  status: PurchaseOrderStatus;
}

export interface PurchaseOrderItem {
  id: string;
  tenant_id: string;
  purchase_order_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_cost_cents: number;
  line_total_cost_cents: number;
  created_at: string;
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

// Phase 7: Platform (subscriptions, M-Pesa, SMS, notifications, CMS) -------

export type PlanLimits = Partial<
  Record<"farmers" | "farms" | "houses" | "flocks" | "users" | "field_officers", number>
>;

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  billing_interval: "monthly" | "annual";
  limits: PlanLimits;
  is_active: boolean;
  sort_order: number;
}

/** Stored/base status only. The *effective* status shown to users
 * (trial/active/grace_period/past_due/suspended/expired) is computed by
 * deriveSubscriptionStatus() in src/lib/data/subscriptions.ts from the
 * dates below — there is no cron job flipping this column on a timer. */
export type SubscriptionBaseStatus = "trial" | "active" | "cancelled";
export type EffectiveSubscriptionStatus =
  | "trial"
  | "active"
  | "grace_period"
  | "past_due"
  | "suspended"
  | "expired"
  | "cancelled";

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionBaseStatus;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type MpesaTransactionStatus = "initiated" | "pending" | "success" | "failed" | "cancelled";

export interface MpesaTransaction {
  id: string;
  tenant_id: string;
  subscription_id: string | null;
  phone: string;
  amount_cents: number;
  status: MpesaTransactionStatus;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  mpesa_receipt_number: string | null;
  result_desc: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | "vaccination_due"
  | "low_stock"
  | "mortality_alert"
  | "subscription"
  | "support_ticket"
  | "task_assigned"
  | "general"
  | "production_decline"
  | "feed_stockout";

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  vaccination_due: boolean;
  low_stock: boolean;
  mortality_alert: boolean;
  subscription: boolean;
  support_ticket: boolean;
  task_assigned: boolean;
}

export type SmsStatus = "queued" | "sent" | "delivered" | "failed";

export interface SmsLog {
  id: string;
  tenant_id: string;
  to_phone: string;
  message: string;
  provider: string;
  provider_message_id: string | null;
  status: SmsStatus;
  error: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  tenant_id: string | null;
  title: string;
  body: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

export type MarketplaceCategory = "eggs" | "birds" | "manure" | "feed_request" | "other";
export type MarketplaceListingStatus = "active" | "fulfilled" | "expired" | "cancelled";

export interface MarketplaceListing {
  id: string;
  tenant_id: string;
  farm_id: string;
  flock_id: string | null;
  category: MarketplaceCategory;
  title: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  price_cents: number | null;
  location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: MarketplaceListingStatus;
  created_by: string | null;
  created_at: string;
  expires_at: string;
}

/** What poultryedos_marketplace_browse() returns -- a curated, cross-tenant
 * projection, never the raw table (see migration 0028). */
export interface MarketplaceBrowseRow {
  id: string;
  category: MarketplaceCategory;
  title: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  price_cents: number | null;
  location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  seller_name: string;
  created_at: string;
}
