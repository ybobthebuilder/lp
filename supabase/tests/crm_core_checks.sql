-- TASK-T7b SQL-level checks. Run on the TEST project only, synthetic data only.
-- Usage: psql -v ON_ERROR_STOP=1 -f supabase/tests/crm_core_checks.sql
-- Everything runs in a transaction that is rolled back.
begin;
set local role service_role;

insert into public.lead_magnets (slug, title) values ('test-magnet', 'Test magnet');

-- AC4: same email twice -> 1 contact; same idempotency key -> 1 event.
select public.capture_lead('test+1@example.com', '+5511900000000', 'v-test', 'test-magnet', '{"utm_source":"test"}', 'idem-1');
select public.capture_lead('test+1@example.com', '+5511900000000', 'v-test', 'test-magnet', '{}', 'idem-2');
select public.capture_lead('test+1@example.com', '+5511900000000', 'v-test', 'test-magnet', '{}', 'idem-2');
do $$ begin
  assert (select count(*) from public.contacts where email = 'test+1@example.com') = 1, 'duplicate contact';
  assert (select count(*) from public.events where idempotency_key = 'idem-2') = 1, 'duplicate event';
  assert (select count(*) from public.consents) = 4, 'expected 2 consents per accepted call';
end $$;

-- Required fields.
do $$ begin
  begin perform public.capture_lead(null, '+5511900000001', 'v-test', null, null, 'idem-3');
    raise exception 'missing email accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.capture_lead('test+2@example.com', null, 'v-test', null, null, 'idem-4');
    raise exception 'missing whatsapp accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.capture_lead('test+2@example.com', '+5511900000001', '', null, null, 'idem-5');
    raise exception 'missing consent version accepted'; exception when sqlstate '22023' then null; end;
end $$;

-- AC5: UPDATE / DELETE on consents and events fail.
do $$ begin
  begin update public.consents set text_version = 'x'; raise exception 'consents update allowed';
    exception when sqlstate '42501' then null; end;
  begin delete from public.consents; raise exception 'consents delete allowed';
    exception when sqlstate '42501' then null; end;
  begin update public.events set type = 'x'; raise exception 'events update allowed';
    exception when sqlstate '42501' then null; end;
  begin delete from public.events; raise exception 'events delete allowed';
    exception when sqlstate '42501' then null; end;
end $$;

-- RLS on all 4 tables, no policies, no anon/authenticated grants.
reset role;
do $$ begin
  assert (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname in ('contacts','consents','events','lead_magnets')
            and c.relrowsecurity) = 4, 'RLS not enabled on all tables';
  assert (select count(*) from pg_policies where schemaname = 'public'
          and tablename in ('contacts','consents','events','lead_magnets')) = 0, 'unexpected policies';
  assert not exists (select 1 from information_schema.role_table_grants
          where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')
            and table_name in ('contacts','consents','events','lead_magnets')), 'anon/authenticated grant found';
  assert not has_function_privilege('anon', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'anon can execute';
  assert not has_function_privilege('authenticated', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'authenticated can execute';
  assert has_function_privilege('service_role', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute'), 'service_role cannot execute';
end $$;

select 'crm_core_checks: ALL PASS';
rollback;
