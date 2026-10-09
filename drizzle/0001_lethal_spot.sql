CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_public_page` ON `comments` (`status`,`created_at`,`id`);