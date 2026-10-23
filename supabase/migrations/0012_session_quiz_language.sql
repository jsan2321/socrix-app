-- Migration 0012: Add quiz_language column to user_sessions
-- Supports user-selected practice language ('auto', 'es', 'en')

ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS quiz_language varchar(10) DEFAULT 'auto';
