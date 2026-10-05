CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`vehicle` text NOT NULL,
	`service` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_slot` ON `bookings` (`date`,`time`) WHERE "bookings"."status" IN ('confirmed','blocked');--> statement-breakpoint
CREATE INDEX `bookings_date` ON `bookings` (`date`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`hits` integer NOT NULL
);
