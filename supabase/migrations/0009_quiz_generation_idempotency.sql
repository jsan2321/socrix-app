alter table public.quiz_questions
  add column session_id uuid references public.user_sessions(id) on delete cascade,
  add column generation_request_id uuid,
  add constraint quiz_questions_request_pair_check
    check ((session_id is null) = (generation_request_id is null));

create unique index quiz_questions_session_request_idx
  on public.quiz_questions (session_id, generation_request_id)
  where generation_request_id is not null;

create or replace function public.persist_quiz_generation(
  p_session_id uuid,
  p_request_id uuid,
  p_document_id uuid,
  p_concept text,
  p_difficulty text,
  p_grounding_chunk_ids uuid[],
  p_generation_provider text,
  p_generation_model text,
  p_generation_attempts integer,
  p_statements jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_question_id uuid;
begin
  if jsonb_array_length(p_statements) <> 3 or
     (select count(*) from jsonb_array_elements(p_statements) item where (item->>'isTrue')::boolean) <> 1 then
    raise exception 'A quiz question requires three statements and exactly one truth';
  end if;

  insert into public.quiz_questions (
    document_id, session_id, generation_request_id, concept, difficulty,
    grounding_chunk_ids, generation_provider, generation_model, generation_attempts
  ) values (
    p_document_id, p_session_id, p_request_id, p_concept, p_difficulty,
    p_grounding_chunk_ids, p_generation_provider, p_generation_model, p_generation_attempts
  )
  on conflict (session_id, generation_request_id) where generation_request_id is not null do nothing
  returning id into v_question_id;

  if v_question_id is null then
    select id into v_question_id
    from public.quiz_questions
    where session_id = p_session_id and generation_request_id = p_request_id;
    return v_question_id;
  end if;

  insert into public.quiz_statements (question_id, text, is_true, grounding_rationale, display_order)
  select v_question_id, item->>'text', (item->>'isTrue')::boolean,
         item->>'groundingRationale', (item->>'displayOrder')::integer
  from jsonb_array_elements(p_statements) item;

  return v_question_id;
end;
$$;

revoke all on function public.persist_quiz_generation(uuid, uuid, uuid, text, text, uuid[], text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.persist_quiz_generation(uuid, uuid, uuid, text, text, uuid[], text, text, integer, jsonb) to service_role;
