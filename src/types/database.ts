/**
 * Supabase CLI `supabase gen types typescript` çıktısıyla uyumlu Database tipi.
 * supabase/migrations/*.sql şemasını birebir yansıtır.
 * Not: PostgREST numeric alanları number olarak serialize eder; yerel Drizzle
 * çalışma modunda aynı alanlar decimal-safe string olarak taşınır.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "MEMBER" | "PARTNER_ADMIN" | "OPERATOR" | "AUDITOR" | "ADMIN";

export type CouponStatus =
  | "DRAFT"
  | "UPLOADED"
  | "OCR_PROCESSING"
  | "OCR_FAILED"
  | "AI_PROCESSING"
  | "NEEDS_REVIEW"
  | "READY_FOR_MEMBER_APPROVAL"
  | "MEMBER_APPROVED"
  | "PARTNER_QUEUE"
  | "PARTNER_PROCESSING"
  | "PLATFORM_PREPARING"
  | "PENDING_CONFIRMATION"
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED"
  | "ODDS_CHANGED"
  | "RESULT_PENDING"
  | "WON"
  | "LOST"
  | "RESULT_UPDATED"
  | "SETTLED"
  | "FAILED"
  | "CANCELLED";

type InsertOf<Row, Req extends keyof Row> = Pick<Row, Req> & Partial<Omit<Row, Req>>;
type UpdateOf<Row> = Partial<Row>;

export type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MemberRow = {
  id: string;
  auth_user_id: string;
  member_code: string;
  full_name: string;
  phone: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MemberDeviceRow = {
  id: string;
  member_id: string;
  device_name: string | null;
  platform: string | null;
  passkey_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type CouponRow = {
  id: string;
  coupon_code: string;
  member_id: string;
  status: CouponStatus;
  physical_coupon_date: string | null;
  physical_coupon_time: string | null;
  uploaded_at: string | null;
  ai_processed_at: string | null;
  member_approved_at: string | null;
  partner_received_at: string | null;
  partner_processed_at: string | null;
  platform_processed_at: string | null;
  result_updated_at: string | null;
  platform_transaction_id: string | null;
  printed_total_odds: number | null;
  accepted_total_odds: number | null;
  stake_amount: number | null;
  potential_return: number | null;
  final_result: string | null;
  approval_version: number;
  submission_version: number;
  created_at: string;
  updated_at: string;
};

export type CouponBetRow = {
  id: string;
  coupon_id: string;
  row_number: number;
  home_team: string;
  away_team: string;
  league: string | null;
  market: string;
  selection: string;
  printed_odds: number | null;
  matched_odds: number | null;
  event_id: string | null;
  market_id: string | null;
  selection_id: string | null;
  ocr_confidence: number | null;
  ai_confidence: number | null;
  event_confidence: number | null;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
};

export type CouponImageRow = {
  id: string;
  coupon_id: string;
  storage_path: string;
  image_type: string;
  mime_type: string;
  size_bytes: number | null;
  sha256: string;
  ocr_processed: boolean;
  created_at: string;
};

export type OcrResultRow = {
  id: string;
  coupon_id: string;
  engine: string;
  raw_text: string | null;
  confidence: number | null;
  processing_time_ms: number | null;
  created_at: string;
};

export type AiCouponParseRow = {
  id: string;
  coupon_id: string;
  model: string;
  prompt_version: string;
  result_json: Json | null;
  confidence: number | null;
  needs_review: boolean;
  created_at: string;
};

export type OddsSnapshotRow = {
  id: string;
  coupon_bet_id: string;
  printed_odds: number;
  observed_odds: number;
  difference: number;
  observed_at: string;
  source: string;
  created_at: string;
};

export type CouponStatusHistoryRow = {
  id: string;
  coupon_id: string;
  old_status: CouponStatus | null;
  new_status: CouponStatus;
  changed_by: string | null;
  reason: string | null;
  metadata: Json | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
};

export type IdempotencyKeyRow = {
  key: string;
  scope: string;
  entity_type: string;
  entity_id: string | null;
  response_json: Json;
  created_at: string;
};

export type SettlementRow = {
  id: string;
  coupon_id: string;
  member_id: string;
  platform_reference: string;
  gross_result: number;
  partner_settlement: number;
  member_amount: number;
  currency: string;
  status: string;
  settlement_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberLedgerRow = {
  id: string;
  member_id: string;
  coupon_id: string | null;
  transaction_type: string;
  amount: number;
  currency: string;
  balance_after: number;
  reference_id: string;
  description: string | null;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  member_id: string;
  coupon_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type TeamRow = {
  id: string;
  canonical_name: string;
  normalized_name: string;
  aliases: string[];
  league: string | null;
  created_at: string;
};

export type EventCatalogRow = {
  id: string;
  external_id: string;
  home_team: string;
  away_team: string;
  league: string | null;
  event_date: string | null;
  start_time: string | null;
  markets: Record<string, Record<string, string>>;
  source: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: TeamRow;
        Insert: InsertOf<TeamRow, "canonical_name" | "normalized_name">;
        Update: UpdateOf<TeamRow>;
        Relationships: [];
      };
      event_catalog: {
        Row: EventCatalogRow;
        Insert: InsertOf<EventCatalogRow, "external_id" | "home_team" | "away_team">;
        Update: UpdateOf<EventCatalogRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow, "id">;
        Update: UpdateOf<ProfileRow>;
        Relationships: [];
      };
      members: {
        Row: MemberRow;
        Insert: InsertOf<MemberRow, "auth_user_id" | "member_code" | "full_name" | "phone">;
        Update: UpdateOf<MemberRow>;
        Relationships: [];
      };
      member_devices: {
        Row: MemberDeviceRow;
        Insert: InsertOf<MemberDeviceRow, "member_id">;
        Update: UpdateOf<MemberDeviceRow>;
        Relationships: [];
      };
      coupons: {
        Row: CouponRow;
        Insert: InsertOf<CouponRow, "coupon_code" | "member_id">;
        Update: UpdateOf<CouponRow>;
        Relationships: [];
      };
      coupon_bets: {
        Row: CouponBetRow;
        Insert: InsertOf<
          CouponBetRow,
          "coupon_id" | "row_number" | "home_team" | "away_team" | "market" | "selection"
        >;
        Update: UpdateOf<CouponBetRow>;
        Relationships: [];
      };
      coupon_images: {
        Row: CouponImageRow;
        Insert: InsertOf<CouponImageRow, "coupon_id" | "storage_path" | "sha256">;
        Update: UpdateOf<CouponImageRow>;
        Relationships: [];
      };
      ocr_results: {
        Row: OcrResultRow;
        Insert: InsertOf<OcrResultRow, "coupon_id" | "engine">;
        Update: UpdateOf<OcrResultRow>;
        Relationships: [];
      };
      ai_coupon_parses: {
        Row: AiCouponParseRow;
        Insert: InsertOf<AiCouponParseRow, "coupon_id" | "model" | "prompt_version">;
        Update: UpdateOf<AiCouponParseRow>;
        Relationships: [];
      };
      odds_snapshots: {
        Row: OddsSnapshotRow;
        Insert: InsertOf<OddsSnapshotRow, "coupon_bet_id" | "printed_odds" | "observed_odds" | "difference" | "observed_at" | "source">;
        Update: UpdateOf<OddsSnapshotRow>;
        Relationships: [];
      };
      coupon_status_history: {
        Row: CouponStatusHistoryRow;
        Insert: InsertOf<CouponStatusHistoryRow, "coupon_id" | "new_status">;
        Update: UpdateOf<CouponStatusHistoryRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: InsertOf<AuditLogRow, "actor_role" | "action" | "entity_type">;
        Update: UpdateOf<AuditLogRow>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: IdempotencyKeyRow;
        Insert: InsertOf<IdempotencyKeyRow, "key" | "scope" | "entity_type" | "response_json">;
        Update: UpdateOf<IdempotencyKeyRow>;
        Relationships: [];
      };
      settlements: {
        Row: SettlementRow;
        Insert: InsertOf<
          SettlementRow,
          "coupon_id" | "member_id" | "platform_reference" | "gross_result" | "partner_settlement" | "member_amount"
        >;
        Update: UpdateOf<SettlementRow>;
        Relationships: [];
      };
      member_ledger: {
        Row: MemberLedgerRow;
        Insert: InsertOf<MemberLedgerRow, "member_id" | "transaction_type" | "amount" | "balance_after" | "reference_id">;
        Update: UpdateOf<MemberLedgerRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: InsertOf<NotificationRow, "member_id" | "type" | "title">;
        Update: UpdateOf<NotificationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
