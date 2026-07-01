/*
# Add manually_unsuspended flag to prevent re-suspension after admin unsuspend

## Overview
When an admin manually unsuspends a user, the IP abuse detection should NOT
re-suspend them automatically. This adds a flag that tracks manual unsuspension.

## Changes
- users table: add `manually_unsuspended` boolean column (default false)
- When admin unsuspends, this is set to true
- IP abuse detection skips users where manually_unsuspended is true
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS manually_unsuspended boolean NOT NULL DEFAULT false;
