CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`pickup_label` text NOT NULL,
	`capacity` integer NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`batch_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text NOT NULL,
	`item_count` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`stripe_session_id` text,
	`reservation_expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`paid_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);