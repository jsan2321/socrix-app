CREATE INDEX idx_documents_user_created_at ON public.documents(user_id, created_at DESC);
CREATE INDEX idx_user_sessions_user_document_created_at ON public.user_sessions(user_id, document_id, created_at DESC);
CREATE INDEX idx_session_answers_session_answered_at ON public.session_answers(session_id, answered_at DESC);
