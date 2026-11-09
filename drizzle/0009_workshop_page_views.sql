CREATE TABLE `workshop_page_views` (
	`day` text NOT NULL,
	`page` text NOT NULL,
	`views` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workshop_page_views_day_page` ON `workshop_page_views` (`day`,`page`);