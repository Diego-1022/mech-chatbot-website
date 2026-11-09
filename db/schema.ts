import {sql} from "drizzle-orm";import {sqliteTable,text,integer,uniqueIndex,index} from "drizzle-orm/sqlite-core";
export const customers=sqliteTable("customers",{id:text("id").primaryKey(),name:text("name").notNull(),email:text("email").notNull().unique(),passwordHash:text("password_hash").notNull(),emailVerifiedAt:text("email_verified_at"),createdAt:text("created_at").notNull()});
export const customerSessions=sqliteTable("customer_sessions",{tokenHash:text("token_hash").primaryKey(),customerId:text("customer_id").notNull().references(()=>customers.id),expiresAt:integer("expires_at").notNull()},t=>[index("customer_sessions_expiry").on(t.expiresAt)]);
export const customerChat=sqliteTable("customer_chat",{id:text("id").primaryKey(),customerId:text("customer_id").notNull().references(()=>customers.id),messageJson:text("message_json").notNull(),createdAt:integer("created_at").notNull()},t=>[index("customer_chat_history").on(t.customerId,t.createdAt,t.id)]);
export const bookings=sqliteTable("bookings",{id:text("id").primaryKey(),customerId:text("customer_id").references(()=>customers.id),tokenHash:text("token_hash").notNull(),name:text("name").notNull(),email:text("email").notNull(),phone:text("phone").notNull(),vehicle:text("vehicle").notNull(),service:text("service").notNull(),date:text("date").notNull(),time:text("time").notNull(),notes:text("notes").notNull().default(""),status:text("status").notNull().default("confirmed"),createdAt:text("created_at").notNull()},t=>[uniqueIndex("one_active_slot").on(t.date,t.time).where(sql`${t.status} IN ('confirmed','blocked')`),index("bookings_date").on(t.date),index("bookings_customer").on(t.customerId)]);
export const rateLimits=sqliteTable("rate_limits",{key:text("key").primaryKey(),window:integer("window").notNull(),hits:integer("hits").notNull()});
export const comments=sqliteTable("comments",{id:text("id").primaryKey(),name:text("name").notNull().default(""),message:text("message").notNull(),status:text("status",{enum:["visible","hidden"]}).notNull().default("visible"),createdAt:text("created_at").notNull()},t=>[index("comments_public_page").on(t.status,t.createdAt,t.id)]);
export const bookingPhotos=sqliteTable("booking_photos",{id:text("id").primaryKey(),bookingId:text("booking_id").notNull().references(()=>bookings.id),slot:integer("slot").notNull(),name:text("name").notNull(),mime:text("mime").notNull(),size:integer("size").notNull(),storageKey:text("storage_key").notNull(),status:text("status",{enum:["uploading","ready"]}).notNull(),uploadNonce:text("upload_nonce").notNull(),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull()},t=>[uniqueIndex("booking_photo_slot").on(t.bookingId,t.slot),index("booking_photos_booking").on(t.bookingId)]);

export const emailVerifications=sqliteTable("email_verifications",{customerId:text("customer_id").primaryKey().references(()=>customers.id),tokenHash:text("token_hash").notNull().unique(),expiresAt:integer("expires_at").notNull()});

export const workshopNotice = sqliteTable("workshop_notice", {
  id: integer("id").primaryKey(),
  messageEn: text("message_en").notNull(),
  messageZh: text("message_zh").notNull(),
});

export const workshopReceipts = sqliteTable("workshop_receipts", {
  bookingId: text("booking_id").primaryKey().notNull().references(()=>bookings.id),
  paidOn: text("paid_on").notNull(),
  amountCents: integer("amount_cents").notNull(),
}, t=>[index("workshop_receipts_paid_on").on(t.paidOn)]);

export const workshopPrices = sqliteTable("workshop_prices", {
  service: text("service").primaryKey().notNull(),
  min: integer("min").notNull(),
  max: integer("max").notNull(),
});

export const workshopExpenses = sqliteTable("workshop_expenses", {
  id: text("id").primaryKey(),
  item: text("item").notNull(),
  supplier: text("supplier").notNull(),
  kind: text("kind",{enum:["purchase","recurring"]}).notNull(),
  quantity: integer("quantity").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueOn: text("due_on").notNull(),
  status: text("status",{enum:["open","settled","cancelled"]}).notNull().default("open"),
  repeatMonths: integer("repeat_months").notNull(),
  repeatDay: integer("repeat_day").notNull(),
}, t=>[index("workshop_expenses_due").on(t.dueOn)]);
