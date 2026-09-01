import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const batches = sqliteTable("batches", {
  id: text("id").primaryKey(),
  pickupLabel: text("pickup_label").notNull(),
  pickupDate: text("pickup_date").notNull().default(""),
  cutoffAt: integer("cutoff_at").notNull().default(0),
  capacity: integer("capacity").notNull(),
  reserved: integer("reserved").notNull().default(0),
  isOpen: integer("is_open").notNull().default(0),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  batchId: text("batch_id").notNull(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  itemCount: integer("item_count").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending_payment"),
  squareOrderId: text("square_order_id").unique(),
  squareLinkId: text("square_link_id"),
  squareLinkUrl: text("square_link_url"),
  squareRequestJson: text("square_request_json"),
  paymentEnvironment: text("payment_environment"),
  stripeSessionId: text("stripe_session_id").unique(),
  reservationExpiresAt: integer("reservation_expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  paidAt: integer("paid_at"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
});

export const checkoutRateLimits = sqliteTable("checkout_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});
