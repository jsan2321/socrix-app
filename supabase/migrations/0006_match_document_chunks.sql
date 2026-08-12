-- ============================================================
-- match_document_chunks RPC Function
-- Fast pgvector similarity search over document chunks for a single document
-- ============================================================

create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_document_id uuid,
  match_threshold float default 0.70,
  match_count int default 5
)
returns table (
  chunk jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    to_jsonb(dc.*) as chunk,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.document_id = match_document_id
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding asc
  limit match_count;
end;
$$;
