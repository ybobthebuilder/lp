-- TASK-T7f SQL-level checks for capture_lead (cross-contact refusal). TEST project only,
-- synthetic data only. Usage: psql -v ON_ERROR_STOP=1 -f supabase/tests/crm_capture_refuse_cross_checks.sql
-- Runs in a transaction that is rolled back. Concurrency needs two sessions; see the PR.
begin;

do $$ begin
  assert not has_function_privilege('anon', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'anon can execute';
  assert not has_function_privilege('authenticated', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'authenticated can execute';
  assert has_function_privilege('service_role', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'service_role cannot execute';
  assert (select prosecdef from pg_proc where oid = 'public.capture_lead(text,text,text,text,jsonb,text)'::regprocedure) = false, 'not security invoker';
  assert (select proconfig from pg_proc where oid = 'public.capture_lead(text,text,text,text,jsonb,text)'::regprocedure) = array['search_path=""'], 'search_path not empty';
end $$;

set local role service_role;

-- Setup: contacts A and B.
do $$ begin
  perform public.capture_lead('t7f+a@example.com', '+5511900000031', 'v-test', null, '{}', 't7f-setup-a');
  perform public.capture_lead('t7f+b@example.com', '+5511900000032', 'v-test', null, '{}', 't7f-setup-b');
end $$;

-- Sequential A+B (email of A, whatsapp of B) -> LP001, 0 new rows, last_seen untouched.
do $$ declare c0 bigint; k0 bigint; e0 bigint; ls0 timestamptz; refused boolean := false; begin
  select count(*) into c0 from public.contacts;
  select count(*) into k0 from public.consents;
  select count(*) into e0 from public.events;
  select max(last_seen) into ls0 from public.contacts where email in ('t7f+a@example.com','t7f+b@example.com');
  begin
    perform public.capture_lead(' T7F+A@example.com ', '+5511900000032', 'v-test', null, '{}', 't7f-cross-1');
  exception when sqlstate 'LP001' then refused := true;
    assert sqlerrm = 'capture_lead: identifiers belong to different contacts', 'unexpected message';
  end;
  assert refused, 'A+B was not refused with LP001';
  assert (select count(*) from public.contacts) = c0, 'contacts written';
  assert (select count(*) from public.consents) = k0, 'consents written';
  assert (select count(*) from public.events) = e0, 'events written';
  assert (select count(*) from public.events where idempotency_key = 't7f-cross-1') = 0, 'event for refused key';
  assert (select max(last_seen) from public.contacts where email in ('t7f+a@example.com','t7f+b@example.com')) = ls0, 'last_seen touched';
end $$;

-- Unchanged: both match the same contact -> same id, 2 more consents, 1 more event.
do $$ declare a uuid; r uuid; begin
  select id into a from public.contacts where email = 't7f+a@example.com';
  r := public.capture_lead('t7f+a@example.com', '+5511900000031', 'v-test', null, '{}', 't7f-same');
  assert r = a, 'both-same returned another id';
  assert (select count(*) from public.consents where contact_id = a) = 4, 'both-same consents';
  assert (select count(*) from public.events where contact_id = a) = 2, 'both-same events';
end $$;

-- Unchanged: email-only match (new whatsapp) -> contact A, whatsapp not changed.
do $$ declare a uuid; r uuid; begin
  select id into a from public.contacts where email = 't7f+a@example.com';
  r := public.capture_lead('t7f+a@example.com', '+5511900000039', 'v-test', null, '{}', 't7f-email-only');
  assert r = a, 'email-only returned another id';
  assert (select whatsapp from public.contacts where id = a) = '+5511900000031', 'whatsapp changed';
end $$;

-- Unchanged: whatsapp-only match (new email) -> contact B, email not changed.
do $$ declare b uuid; r uuid; begin
  select id into b from public.contacts where email = 't7f+b@example.com';
  r := public.capture_lead('t7f+new@example.com', '+5511900000032', 'v-test', null, '{}', 't7f-wa-only');
  assert r = b, 'wa-only returned another id';
  assert not exists (select 1 from public.contacts where email = 't7f+new@example.com'), 'new contact created';
end $$;

-- T7e idempotency kept: replay of an accepted key returns its contact even when the
-- identifiers now cross (replay check runs before the cross check).
do $$ declare a uuid; r uuid; k0 bigint; begin
  select id into a from public.contacts where email = 't7f+a@example.com';
  select count(*) into k0 from public.consents;
  r := public.capture_lead('t7f+a@example.com', '+5511900000032', 'v-test', null, '{}', 't7f-same');
  assert r = a, 'replay did not return the stored contact';
  assert (select count(*) from public.consents) = k0, 'replay wrote consents';
end $$;

-- Unchanged: neither matches -> new contact.
do $$ declare r uuid; begin
  r := public.capture_lead('t7f+c@example.com', '+5511900000033', 'v-test', null, '{}', 't7f-new');
  assert (select email from public.contacts where id = r) = 't7f+c@example.com', 'new contact missing';
end $$;

rollback;
