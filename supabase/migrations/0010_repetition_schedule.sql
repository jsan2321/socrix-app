-- Spaced repetition schedule for tracking concept retention and review intervals.
CREATE TABLE IF NOT EXISTS public.repetition_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  concept text NOT NULL,
  interval_days integer NOT NULL DEFAULT 1,
  ease_factor numeric(4,2) NOT NULL DEFAULT 2.50,
  repetition_count integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz DEFAULT now(),
  next_review_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT repetition_schedule_user_doc_concept_uniq UNIQUE (user_id, document_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_repetition_user_next_review
  ON public.repetition_schedule(user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_repetition_document_id
  ON public.repetition_schedule(document_id);

ALTER TABLE public.repetition_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own repetition schedule" ON public.repetition_schedule
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
