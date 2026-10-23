-- Authenticated ownership for documents and study sessions.
ALTER TABLE public.documents ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_sessions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);

-- A hash may be reused by different accounts, but never duplicated within one account.
DROP INDEX IF EXISTS public.documents_content_hash_ready_idx;
CREATE UNIQUE INDEX idx_documents_user_content_hash_ready
  ON public.documents(user_id, content_hash) WHERE status = 'ready';

-- Prevent a direct authenticated insert from attaching a session to another user's document.
CREATE FUNCTION public.enforce_session_document_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = NEW.document_id AND d.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Session owner must own its document';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_session_document_owner_trigger
  BEFORE INSERT OR UPDATE OF user_id, document_id ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_document_owner();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents" ON public.documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read chunks for own documents" ON public.document_chunks
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid()));
CREATE POLICY "Users read questions for own documents" ON public.quiz_questions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid()));
CREATE POLICY "Users read statements for own documents" ON public.quiz_statements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.quiz_questions q JOIN public.documents d ON d.id = q.document_id
    WHERE q.id = question_id AND d.user_id = auth.uid()
  ));
CREATE POLICY "Users manage own sessions" ON public.user_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage answers for own sessions" ON public.session_answers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
