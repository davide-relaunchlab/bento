CREATE TABLE `agent_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`workbook_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`permission` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workbook_id`) REFERENCES `workbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_hash` ON `agent_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `tokens_workbook` ON `agent_tokens` (`workbook_id`);--> statement-breakpoint
CREATE TABLE `changes` (
	`workbook_id` text NOT NULL,
	`revision` integer NOT NULL,
	`id` text NOT NULL,
	`operation_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`content_key` text NOT NULL,
	`prepared_key` text,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_kind` text NOT NULL,
	`summary` text NOT NULL,
	`kind` text NOT NULL,
	`related_id` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`workbook_id`, `revision`),
	FOREIGN KEY (`workbook_id`) REFERENCES `workbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `changes_operation` ON `changes` (`workbook_id`,`operation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `changes_id` ON `changes` (`workbook_id`,`id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`workbook_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workbook_id`) REFERENCES `workbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_workbook_email` ON `members` (`workbook_id`,`email`);--> statement-breakpoint
CREATE INDEX `members_user` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`workbook_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`base_revision` integer NOT NULL,
	`prepared_key` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_kind` text NOT NULL,
	`summary` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_by` text,
	`change_id` text,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`workbook_id`) REFERENCES `workbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_operation` ON `proposals` (`workbook_id`,`operation_id`);--> statement-breakpoint
CREATE INDEX `proposals_workbook` ON `proposals` (`workbook_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `workbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`doc_id` text NOT NULL,
	`title` text NOT NULL,
	`owner_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`acl_version` integer DEFAULT 0 NOT NULL,
	`content_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
