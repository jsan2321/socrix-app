-- ============================================================
-- documents table
-- Stores ingested PDF metadata, content hash, and status
-- ============================================================
create table documents (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  content_hash          text not null,
  status                text not null default 'processing'
                          check (status in ('processing', 'ready', 'failed')),
  failure_reason        text
                          check (failure_reason in (
                            'encrypted', 'malformed', 'no_extractable_text',
                            'likely_scanned', 'embedding_error', 'unknown'
                          )),
  page_count            integer,
  chunks_total          integer,
  chunks_embedded_count integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Duplicate content hash detection index (only for successfully ready documents)
create unique index documents_content_hash_ready_idx
  on documents (content_hash)
  where status = 'ready';
