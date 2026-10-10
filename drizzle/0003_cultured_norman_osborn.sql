CREATE TABLE `customer_chat` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`message_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `customer_chat_history` ON `customer_chat` (`customer_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `customer_sessions_expiry` ON `customer_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_unique` ON `customers` (`email`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `customer_id` text REFERENCES customers(id);--> statement-breakpoint
CREATE INDEX `bookings_customer` ON `bookings` (`customer_id`);