CREATE TABLE `workshop_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`item` text NOT NULL,
	`supplier` text NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_on` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`repeat_months` integer NOT NULL,
	`repeat_day` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workshop_expenses_due` ON `workshop_expenses` (`due_on`);