-- TASK-T7e SQL-level checks for capture_lead. TEST project only, synthetic data only.
-- Usage: psql -v ON_ERROR_STOP=1 -f supabase/tests/crm_capture_idempotent_checks.sql
-- Runs in a transaction that is rolled back. Concurrency itself needs two sessions;
-- see the PR for the two-session procedure. Counts are scoped to rows from this run.
begin;

do $$ begin
  assert not has_function_privilege('anon', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'anon can execute';
  assert not has_function_privilege('authenticated', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'authenticated can execute';
  assert has_function_privilege('service_role', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'service_role cannot execute';
  assert (select prosecdef from pg_proc where oid = 'public.capture_lead(text,text,text,text,jsonb,text)'::regprocedure) = false, 'not security invoker';
end $$;

set local role service_role;

-- Same key twice -> 1 contact, 2 consents, 1 event; same id returned.
do $$ declare a uuid; b uuid; begin
  a := public.capture_lead('t7e+a@example.com', '+5511900000020', 'v-test', null, '{}', 't7e-idem-a');
  b := public.capture_lead('t7e+a@example.com', '+5511900000020', 'v-test', null, '{}', 't7e-idem-a');
  assert a = b, 'retry returned another id';
  assert (select count(*) from public.contacts where id = a) = 1, 'contact count';
  assert (select count(*) from public.consents where contact_id = a) = 2, 'consents duplicated';
  assert (select count(*) from public.events where contact_id = a and created_at >= now()) = 1, 'events duplicated';
end $$;

-- New key, same contact -> same contact, 2 more consents, 1 more event.
do $$ declare a uuid; begin
  a := public.capture_lead(' T7E+A@example.com ', '+5511900000020', 'v-test', null, '{}', 't7e-idem-a2');
  assert (select count(*) from public.consents where contact_id = a) = 4, 'consents on new key';
  assert (select count(*) from public.events where contact_id = a) = 2, 'events on new key';
end $$;

-- Unchanged behavior: email of A + whatsapp of B -> resolves to A (email wins), no error.
do $$ declare a uuid; b uuid; c uuid; begin
  a := public.capture_lead('t7e+a@example.com', '+5511900000020', 'v-test', null, '{}', 't7e-idem-a3');
  b := public.capture_lead('t7e+b@example.com', '+5511900000021', 'v-test', null, '{}', 't7e-idem-b1');
  c := public.capture_lead('t7e+a@example.com', '+5511900000021', 'v-test', null, '{}', 't7e-idem-ab');
  assert c = a and a <> b, 'email-wins rule changed';
end $$;

select 'T7e checks passed' as result;
rollback;
