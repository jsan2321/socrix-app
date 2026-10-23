-- Add optional question_target to user_sessions for goal-oriented study sessions.
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS question_target integer DEFAULT NULL;
