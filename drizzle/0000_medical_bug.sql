CREATE TABLE `competencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'service' NOT NULL,
	`source` text DEFAULT 'in-house' NOT NULL,
	`partner_name` text,
	`consultancy_name` text,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`specialties` text DEFAULT '[]' NOT NULL,
	`contact_info` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reference_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`url` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`industry` text,
	`client_name` text,
	`project_date` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reference_projects_created_at` ON `reference_projects` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`client_name` text,
	`industry` text,
	`status` text DEFAULT 'active' NOT NULL,
	`total_topics` integer DEFAULT 0 NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`overall_sentiment` integer,
	`sentiment_data` text,
	`action_items` text,
	`follow_up_questions` text,
	`speakers` text,
	`similar_project_matches` text,
	`bant_data` text,
	`methodology_progress` text,
	`summary` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_created_at` ON `sessions` (`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host_role` text DEFAULT 'host' NOT NULL,
	`analysis_model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`transcription_model` text DEFAULT 'gpt-4o-mini-transcribe' NOT NULL,
	`case_study_urls` text DEFAULT '[]' NOT NULL,
	`sales_methodology` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`term` text NOT NULL,
	`definition` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`type` text DEFAULT 'concept' NOT NULL,
	`capability_source` text DEFAULT 'unknown' NOT NULL,
	`partner_name` text,
	`mention_count` integer DEFAULT 1 NOT NULL,
	`first_mentioned_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_topics_session_id` ON `topics` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_topics_first_mentioned_at` ON `topics` (`first_mentioned_at`);--> statement-breakpoint
CREATE TABLE `voice_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`frequency_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`first_name` text,
	`last_name` text,
	`profile_image_url` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);