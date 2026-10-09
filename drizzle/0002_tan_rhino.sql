CREATE TABLE `booking_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`slot` integer NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`status` text NOT NULL,
	`upload_nonce` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_photo_slot` ON `booking_photos` (`booking_id`,`slot`);--> statement-breakpoint
CREATE INDEX `booking_photos_booking` ON `booking_photos` (`booking_id`);