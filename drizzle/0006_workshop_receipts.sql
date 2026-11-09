CREATE TABLE `workshop_receipts` (
	`booking_id` text PRIMARY KEY NOT NULL,
	`paid_on` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workshop_receipts_paid_on` ON `workshop_receipts` (`paid_on`);