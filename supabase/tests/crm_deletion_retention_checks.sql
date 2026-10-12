-- TASK-T7d SQL-level checks. TEST project only, synthetic data only.
-- Usage: psql -v ON_ERROR_STOP=1 -f supabase/tests/crm_deletion_retention_checks.sql
-- Runs in a transaction that is rolled back.
begin;

-- Role membership: nobody may be a member of crm_owner.
do $$ begin
  assert not pg_has_role('service_role',  'crm_owner', 'member'), 'service_role is member of crm_owner';
  assert not pg_has_role('authenticated', 'crm_owner', 'member'), 'authenticated is member of crm_owner';
  assert not pg_has_role('anon',          'crm_owner', 'member'), 'anon is member of crm_owner';
  assert not exists (select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid
    where r.rolname = 'crm_owner' and (m.set_option or m.inherit_option)), 'crm_owner usable by a member';
  assert (select count(*) from pg_proc p join pg_roles r on r.oid = p.proowner
           where r.rolname = 'crm_owner' and p.proname in
             ('delete_contact','purge_inactive_contacts','record_unsubscribe')) = 3, 'owner not crm_owner';
  assert not has_function_privilege('anon', 'public.delete_contact(text)', 'execute'), 'anon can delete';
  assert not has_function_privilege('authenticated', 'public.record_unsubscribe(text,text)', 'execute'), 'auth can unsubscribe';
  assert not has_function_privilege('anon', 'public.purge_inactive_contacts()', 'execute'), 'anon can purge';
  -- Full matrix: neither anon nor authenticated may execute any of the 3 functions.
  assert not exists (select 1 from unnest(array['public.delete_contact(text)',
      'public.purge_inactive_contacts()', 'public.record_unsubscribe(text,text)']) f,
      unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'execute')), 'anon/authenticated can execute a deletion function';
  assert has_function_privilege('service_role', 'public.delete_contact(text)', 'execute'), 'service_role cannot delete';
  if has_schema_privilege('cron', 'usage') then
    assert (select count(*) from cron.job where jobname = 'crm_purge_inactive_contacts'
             and schedule = '17 4 1 * *') = 1, 'cron job missing';
  end if;
end $$;

set local role service_role;

-- set role crm_owner from service_role must fail. SET ROLE is checked against the
-- session user, so this is only meaningful when connected as a non-superuser
-- (e.g. on Supabase or via a login role that is a member of service_role).
do $$ begin
  if not (select rolsuper from pg_roles where rolname = session_user) then
    begin execute 'set role crm_owner'; raise exception 'set role crm_owner allowed';
    exception when insufficient_privilege then null; end;
  end if;
end $$;

insert into public.lead_magnets (slug, title) values ('test-magnet', 'Test magnet');
select public.capture_lead('t7d+a@example.com', '+5511900000010', 'v-test', 'test-magnet',
  '{"utm_source":"src","utm_medium":"med","utm_campaign":"cmp","utm_content":"leak@example.com","utm_term":"x"}', 'idem-a1');
select public.capture_lead('t7d+b@example.com', '+5511900000011', 'v-test', null, '{}', 'idem-b1');

-- Direct UPDATE/DELETE as service_role fail, also after set_config.
do $$ begin
  perform set_config('app.anything', 'x', false);
  perform set_config('app.bypass', 'crm_owner', false);
  begin update public.consents set text_version = 'x'; raise exception 'consents update allowed';
    exception when insufficient_privilege then null; end;
  begin delete from public.consents; raise exception 'consents delete allowed';
    exception when insufficient_privilege then null; end;
  begin update public.events set type = 'x'; raise exception 'events update allowed';
    exception when insufficient_privilege then null; end;
  begin delete from public.events; raise exception 'events delete allowed';
    exception when insufficient_privilege then null; end;
end $$;

-- record_unsubscribe: twice -> 1 event; unknown -> no error, no row; contact kept.
select public.record_unsubscribe('t7d+b@example.com', 'email');
select public.record_unsubscribe(' T7D+B@example.com ', 'email');
select public.record_unsubscribe('nobody@example.com', 'email');
select public.record_unsubscribe('+5511999999999', 'whatsapp');
do $$ begin
  assert (select count(*) from public.events where type = 'unsubscribed') = 1, 'unsubscribe duplicated/leaked';
  assert (select payload from public.events where type = 'unsubscribed') = '{"channel":"email"}'::jsonb, 'unsubscribe payload';
  assert (select count(*) from public.contacts where email = 't7d+b@example.com') = 1, 'unsubscribe deleted contact';
  begin perform public.record_unsubscribe('t7d+b@example.com', 'sms'); raise exception 'bad channel accepted';
    exception when sqlstate '22023' then null; end;
end $$;

-- delete_contact by email.
do $$ declare v_id uuid; begin
  select id into v_id from public.contacts where email = 't7d+a@example.com';
  perform set_config('t7d.a', v_id::text, true);
  assert public.delete_contact('T7D+A@example.com') > 0, 'delete returned 0';
  assert not exists (select 1 from public.contacts where id = v_id), 'contact remains';
  assert not exists (select 1 from public.consents where contact_id = v_id), 'consent linked';
  assert not exists (select 1 from public.events where contact_id = v_id), 'event linked';
  assert (select count(*) from public.consents where contact_id is null) = 2, 'consents not kept';
  assert (select count(distinct pseudonym_id) from public.consents where contact_id is null) = 1, 'pseudonym not single';
  assert not exists (select 1 from public.consents where contact_id is null and pseudonym_id = v_id), 'pseudonym = contact id';
  assert (select payload from public.events where idempotency_key = 'idem-a1') ?& array['lead_magnet_id','utm_source','utm_medium','utm_campaign'], 'allowlist lost';
  assert not exists (select 1 from public.events where idempotency_key = 'idem-a1'
     and (payload ? 'utm_content' or payload ? 'utm_term' or payload ? 'utm')), 'utm_content kept';
  assert not exists (select 1 from public.events e where e.payload::text like '%leak@example.com%'), 'email in payload';
end $$;

-- delete_contact by WhatsApp.
do $$ begin
  assert public.delete_contact('+5511900000011') > 0, 'whatsapp delete returned 0';
  assert not exists (select 1 from public.contacts where whatsapp = '+5511900000011'), 'contact b remains';
  assert (select count(*) from public.events where type = 'unsubscribed' and contact_id is null) = 1, 'unsub event not anonymized';
end $$;

-- No email/WhatsApp anywhere.
do $$ begin
  assert not exists (select 1 from public.events  e where e.payload::text ~ '(@example\.com|\+55119)'), 'PII in events';
  assert not exists (select 1 from public.consents c where row_to_json(c)::text ~ '(@example\.com|\+55119)'), 'PII in consents';
  assert (select count(*) from public.contacts) = 0, 'contacts left';
end $$;

-- Retention: 25 months purged, 23 months kept.
select public.capture_lead('t7d+old@example.com', '+5511900000012', 'v-test', null, '{}', 'idem-old');
select public.capture_lead('t7d+new@example.com', '+5511900000013', 'v-test', null, '{}', 'idem-new');
update public.contacts set last_seen = now() - interval '25 months' where email = 't7d+old@example.com';
update public.contacts set last_seen = now() - interval '23 months' where email = 't7d+new@example.com';
do $$ begin
  assert public.purge_inactive_contacts() = 1, 'purge count';
  assert not exists (select 1 from public.contacts where email = 't7d+old@example.com'), '25-month kept';
  assert exists (select 1 from public.contacts where email = 't7d+new@example.com'), '23-month purged';
  assert (select count(*) from public.consents where contact_id is null) = 6, 'purged consents not kept';
end $$;

select 'T7d checks passed' as result;
rollback;
