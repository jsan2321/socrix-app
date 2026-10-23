-- ============================================================
-- 0013_production_hardening.sql
-- 1. Allow nullable embedding on document_chunks for resumable batch ingestion
-- 2. Upgrade pgvector index from ivfflat to hnsw for zero-training high recall
-- 3. Add distributed Postgres-backed rate limiting table and atomic RPC
-- ============================================================

-- 1. Nullable embedding for resumable ingestion
ALTER TABLE public.document_chunks
  ALTER COLUMN embedding DROP NOT NULL;

-- Ensure similarity RPC ignores any unembedded chunks
CREATE OR REPLACE FUNCTION public.match_document_chunks (
  query_embedding vector(1536),
  match_document_id uuid,
  match_threshold float default 0.70,
  match_count int default 5
)
RETURNS TABLE (
  chunk jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(dc.*) AS chunk,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.document_id = match_document_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) >= match_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- 2. Upgrade ivfflat index to HNSW index
DROP INDEX IF EXISTS public.document_chunks_embedding_idx;

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 3. Distributed sliding-window rate limiter in Postgres
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id         bigserial PRIMARY KEY,
  rate_key   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_key_time
  ON public.rate_limit_logs (rate_key, created_at);

ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
-- No public policies: only accessible via service_role client / SECURITY DEFINER RPC

GRANT ALL ON TABLE public.rate_limit_logs TO service_role;
GRANT ALL ON SEQUENCE public.rate_limit_logs_id_seq TO service_role;
GRANT ALL ON TABLE public.repetition_schedule TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms bigint
)
RETURNS TABLE (
  allowed boolean,
  current_count integer,
  oldest_epoch_ms bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz := v_now - (p_window_ms || ' milliseconds')::interval;
  v_count integer;
  v_oldest timestamptz;
BEGIN
  -- Prune expired entries for this key
  DELETE FROM public.rate_limit_logs
  WHERE rate_key = p_key AND created_at <= v_window_start;

  SELECT count(*)::integer, min(created_at)
    INTO v_count, v_oldest
  FROM public.rate_limit_logs
  WHERE rate_key = p_key AND created_at > v_window_start;

  IF v_count >= p_limit THEN
    RETURN QUERY SELECT
      false AS allowed,
      v_count AS current_count,
      (extract(epoch FROM COALESCE(v_oldest, v_now)) * 1000)::bigint AS oldest_epoch_ms;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_logs (rate_key, created_at)
  VALUES (p_key, v_now);

  RETURN QUERY SELECT
    true AS allowed,
    (v_count + 1) AS current_count,
    (extract(epoch FROM COALESCE(v_oldest, v_now)) * 1000)::bigint AS oldest_epoch_ms;
END;
$$;
