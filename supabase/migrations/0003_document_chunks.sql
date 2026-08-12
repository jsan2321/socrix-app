-- ============================================================
-- document_chunks table
-- Stores semantic text segments, provenance coordinates, and embeddings
-- ============================================================
create table document_chunks (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references documents(id) on delete cascade,
  chunk_index        integer not null,
  page_start         integer not null,
  page_end           integer not null,
  paragraph_start    integer not null,
  paragraph_end      integer not null,
  sentence_start     integer not null,
  sentence_end       integer not null,
  heading            text,
  text               text not null,
  token_count        integer not null,
  embedding          vector(1536) not null,
  created_at         timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Vector similarity index using ivfflat with cosine distance
create index document_chunks_embedding_idx
  on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Foreign key lookup index
create index document_chunks_document_id_idx on document_chunks (document_id);
