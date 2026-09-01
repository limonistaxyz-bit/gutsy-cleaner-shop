CREATE TABLE `checkout_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `square_order_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `square_link_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `square_link_url` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `square_request_json` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_environment` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_square_order_id_unique` ON `orders` (`square_order_id`);
--> statement-breakpoint
CREATE INDEX orders_batch_status ON orders(batch_id, status);
--> statement-breakpoint
CREATE TRIGGER square_reserve AFTER INSERT ON orders
WHEN NEW.square_request_json IS NOT NULL
BEGIN
  UPDATE batches SET reserved = reserved + NEW.item_count WHERE id = NEW.batch_id;
END;
--> statement-breakpoint
CREATE TRIGGER square_release AFTER UPDATE OF status ON orders
WHEN NEW.square_request_json IS NOT NULL AND NEW.status IN ('expired','checkout_error') AND OLD.status NOT IN ('expired','checkout_error')
BEGIN
  UPDATE batches SET reserved = MAX(0, reserved - NEW.item_count) WHERE id = NEW.batch_id;
END;

--> statement-breakpoint
CREATE TRIGGER batch_capacity_guard BEFORE UPDATE OF capacity ON batches
WHEN NEW.capacity < NEW.reserved
BEGIN
  SELECT RAISE(ABORT, 'capacity_below_reserved');
END;
