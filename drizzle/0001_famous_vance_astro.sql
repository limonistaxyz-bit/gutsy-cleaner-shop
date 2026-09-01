ALTER TABLE `batches` ADD `pickup_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `batches` ADD `cutoff_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `batches` ADD `is_open` integer DEFAULT 0 NOT NULL;