-- ============================================================
-- quiz_questions table
-- Stores generated Socratic Devil's Advocate questions
-- ============================================================
create table quiz_questions (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references documents(id) on delete cascade,
  concept             text not null,
  difficulty          text not null check (difficulty in ('foundational', 'intermediate', 'advanced')),
  grounding_chunk_ids uuid[] not null,
  generation_provider text not null,
  generation_model    text not null,
  generation_attempts integer not null default 1,
  created_at          timestamptz not null default now()
);

create index quiz_questions_document_id_idx on quiz_questions (document_id);

-- ============================================================
-- quiz_statements table
-- Stores statements per question (2 lies + 1 truth)
-- ============================================================
create table quiz_statements (
  id                  uuid primary key default gen_random_uuid(),
  question_id         uuid not null references quiz_questions(id) on delete cascade,
  text                text not null,
  is_true             boolean not null,
  grounding_rationale text not null,
  display_order       integer not null,
  unique (question_id, display_order)
);

-- Enforce exactly one true statement per question at the database level
create unique index quiz_statements_one_truth_idx
  on quiz_statements (question_id)
  where is_true = true;

create index quiz_statements_question_id_idx on quiz_statements (question_id);
