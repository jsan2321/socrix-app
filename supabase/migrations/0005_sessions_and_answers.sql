-- ============================================================
-- user_sessions table
-- Tracks active user learning sessions for a document
-- ============================================================
create table user_sessions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  session_token uuid not null unique,
  mode          text not null check (mode in ('identify_truth', 'identify_both_lies')),
  created_at    timestamptz not null default now()
);

create index user_sessions_document_id_idx on user_sessions (document_id);

-- ============================================================
-- session_answers table
-- Records user answer selections and declared confidence
-- ============================================================
create table session_answers (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid not null references user_sessions(id) on delete cascade,
  question_id            uuid not null references quiz_questions(id) on delete cascade,
  selected_statement_ids uuid[] not null,
  is_correct             boolean not null,
  confidence_level       integer not null check (confidence_level between 1 and 5),
  evidence_viewed        boolean not null default false,
  answered_at            timestamptz not null default now(),
  unique (session_id, question_id)
);

create index session_answers_session_id_idx on session_answers (session_id);
