import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  time,
  numeric,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * KUponum veritabanı şeması.
 * Supabase dağıtımında supabase/migrations/*.sql ile birebir eşleşir;
 * yerel çalışma modunda bu şema `drizzle-kit push` ile uygulanır.
 * Para/oran alanları numeric — TypeScript'te string taşınır (float yok).
 */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

/** Yerel çalışma modu kimlik kaydı. Supabase modunda id = auth.users.id. */
export const authIdentities = pgTable("auth_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  createdAt: createdAt(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  role: text("role").notNull().default("MEMBER"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: uuid("auth_user_id").notNull().unique(),
    memberCode: text("member_code").notNull().unique(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("members_phone_idx").on(t.phone)]
);

export const memberDevices = pgTable(
  "member_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").notNull(),
    deviceName: text("device_name"),
    platform: text("platform"),
    passkeyEnabled: boolean("passkey_enabled").notNull().default(false),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
  },
  (t) => [index("member_devices_member_idx").on(t.memberId)]
);

/** WebAuthn credential — yalnızca PUBLIC key saklanır, biyometrik veri asla. */
export const memberCredentials = pgTable("member_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>().notNull().default([]),
  deviceName: text("device_name"),
  createdAt: createdAt(),
  lastUsedAt: ts("last_used_at"),
});

export const authOtps = pgTable(
  "auth_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    pendingFullName: text("pending_full_name"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("auth_otps_phone_idx").on(t.phone)]
);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  identityId: uuid("identity_id").notNull(),
  userAgent: text("user_agent"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  challenge: text("challenge").notNull(),
  purpose: text("purpose").notNull(),
  phone: text("phone"),
  /** Kayıt (signup) challenge'ında henüz üye olmayan kişinin ad soyadı. */
  fullName: text("full_name"),
  memberId: uuid("member_id"),
  expiresAt: ts("expires_at").notNull(),
  consumedAt: ts("consumed_at"),
  createdAt: createdAt(),
});

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponCode: text("coupon_code").notNull().unique(),
    memberId: uuid("member_id").notNull(),
    status: text("status").notNull().default("DRAFT"),
    physicalCouponDate: date("physical_coupon_date", { mode: "string" }),
    physicalCouponTime: time("physical_coupon_time"),
    uploadedAt: ts("uploaded_at"),
    aiProcessedAt: ts("ai_processed_at"),
    memberApprovedAt: ts("member_approved_at"),
    partnerReceivedAt: ts("partner_received_at"),
    partnerProcessedAt: ts("partner_processed_at"),
    platformProcessedAt: ts("platform_processed_at"),
    resultUpdatedAt: ts("result_updated_at"),
    platformTransactionId: text("platform_transaction_id"),
    printedTotalOdds: numeric("printed_total_odds", { precision: 12, scale: 2 }),
    acceptedTotalOdds: numeric("accepted_total_odds", { precision: 12, scale: 2 }),
    stakeAmount: numeric("stake_amount", { precision: 14, scale: 2 }),
    potentialReturn: numeric("potential_return", { precision: 14, scale: 2 }),
    finalResult: text("final_result"),
    approvalVersion: integer("approval_version").notNull().default(1),
    submissionVersion: integer("submission_version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("coupons_member_idx").on(t.memberId),
    index("coupons_status_idx").on(t.status),
    index("coupons_created_at_idx").on(t.createdAt),
  ]
);

export const couponBets = pgTable(
  "coupon_bets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    league: text("league"),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    printedOdds: numeric("printed_odds", { precision: 10, scale: 2 }),
    matchedOdds: numeric("matched_odds", { precision: 10, scale: 2 }),
    eventId: text("event_id"),
    marketId: text("market_id"),
    selectionId: text("selection_id"),
    ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 4 }),
    aiConfidence: numeric("ai_confidence", { precision: 5, scale: 4 }),
    eventConfidence: numeric("event_confidence", { precision: 5, scale: 4 }),
    needsReview: boolean("needs_review").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("coupon_bets_coupon_idx").on(t.couponId)]
);

export const couponImages = pgTable(
  "coupon_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull(),
    storagePath: text("storage_path").notNull(),
    imageType: text("image_type").notNull().default("original"),
    mimeType: text("mime_type").notNull().default("image/jpeg"),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256").notNull(),
    ocrProcessed: boolean("ocr_processed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("coupon_images_coupon_idx").on(t.couponId)]
);

export const ocrResults = pgTable("ocr_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponId: uuid("coupon_id").notNull(),
  engine: text("engine").notNull(),
  rawText: text("raw_text"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: createdAt(),
});

export const aiCouponParses = pgTable("ai_coupon_parses", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponId: uuid("coupon_id").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  needsReview: boolean("needs_review").notNull().default(true),
  createdAt: createdAt(),
});

export const oddsSnapshots = pgTable(
  "odds_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponBetId: uuid("coupon_bet_id").notNull(),
    printedOdds: numeric("printed_odds", { precision: 10, scale: 2 }).notNull(),
    observedOdds: numeric("observed_odds", { precision: 10, scale: 2 }).notNull(),
    difference: numeric("difference", { precision: 10, scale: 2 }).notNull(),
    observedAt: ts("observed_at").notNull(),
    source: text("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("odds_snapshots_bet_idx").on(t.couponBetId)]
);

export const couponStatusHistory = pgTable(
  "coupon_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status").notNull(),
    changedBy: uuid("changed_by"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("coupon_status_history_coupon_idx").on(t.couponId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeData: jsonb("before_data").$type<Record<string, unknown>>(),
    afterData: jsonb("after_data").$type<Record<string, unknown>>(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_at_idx").on(t.createdAt)]
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  responseJson: jsonb("response_json").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
});

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull(),
    memberId: uuid("member_id").notNull(),
    platformReference: text("platform_reference").notNull().unique(),
    grossResult: numeric("gross_result", { precision: 14, scale: 2 }).notNull(),
    partnerSettlement: numeric("partner_settlement", { precision: 14, scale: 2 }).notNull(),
    memberAmount: numeric("member_amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("TRY"),
    status: text("status").notNull().default("PENDING"),
    settlementAt: ts("settlement_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("settlements_member_idx").on(t.memberId),
    index("settlements_coupon_idx").on(t.couponId),
  ]
);

export const memberLedger = pgTable(
  "member_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").notNull(),
    couponId: uuid("coupon_id"),
    transactionType: text("transaction_type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("TRY"),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
    referenceId: text("reference_id").notNull().unique(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("member_ledger_member_idx").on(t.memberId)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").notNull(),
    couponId: uuid("coupon_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_member_idx").on(t.memberId)]
);

/** Canonical takım kayıtları (Faz 3 normalization). */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: text("canonical_name").notNull().unique(),
  normalizedName: text("normalized_name").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  league: text("league"),
  createdAt: createdAt(),
});

/** Etkinlik kataloğu — demo/entegrasyon beslemesi. Platform adapter'ı Faz 5'te besler. */
export const eventCatalog = pgTable(
  "event_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull().unique(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    league: text("league"),
    eventDate: date("event_date", { mode: "string" }),
    startTime: time("start_time"),
    markets: jsonb("markets").$type<Record<string, Record<string, string>>>().notNull().default({}),
    source: text("source").notNull().default("catalog"),
    createdAt: createdAt(),
  },
  (t) => [index("event_catalog_date_idx").on(t.eventDate)]
);

export type TeamRow = typeof teams.$inferSelect;
export type EventCatalogRow = typeof eventCatalog.$inferSelect;
export type CouponRow = typeof coupons.$inferSelect;
export type CouponInsert = typeof coupons.$inferInsert;
export type MemberRow = typeof members.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type CouponBetRow = typeof couponBets.$inferSelect;
export type CouponImageRow = typeof couponImages.$inferSelect;
export type StatusHistoryRow = typeof couponStatusHistory.$inferSelect;
export type SettlementRow = typeof settlements.$inferSelect;
export type LedgerRow = typeof memberLedger.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type DeviceRow = typeof memberDevices.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
