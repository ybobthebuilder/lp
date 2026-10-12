-- TASK-T7d: deletion (pseudonymize consents, anonymize events), 24-month retention, unsubscribe.
-- Source: docs/adr/0001-behavioral-crm.md (L38-L41, L47-L49). Synthetic data only; no PII/URLs/keys.
-- Function/role names are PROPOSED (spec T7d, PASS cycle 2/2).

-- ADR L39: retention mechanism = pg_cron (monthly).
create extension if not exists pg_cron;

-- Dedicated owner of the deletion functions. NOLOGIN; no role may be a member of it
-- (otherwise `set role crm_owner` would bypass the append-only trigger).
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'crm_owner') then
    create role crm_owner nologin noinherit;
  end if;
end;
$$;

-- Minimal privileges for crm_owner:
--   usage on schema public           -> resolve public.* objects.
--   contacts: select, delete         -> look up by identifier / last_seen, then delete.
--   consents: select, update         -> UPDATE ... WHERE contact_id = x needs SELECT on the filtered column.
--   events:   select, update, insert -> same for anonymization; INSERT for record_unsubscribe.
--   consents/events: delete          -> per spec (minimal set requested by reviewer); not used by the functions today.
grant usage on schema public to crm_owner;
grant select, delete on public.contacts to crm_owner;
grant select, update, delete on public.consents to crm_owner;
grant select, insert, update, delete on public.events to crm_owner;

-- RLS is on with no policies (ADR L47). crm_owner is not the table owner and has no
-- BYPASSRLS, so it needs explicit policies scoped to that role only.
create policy crm_owner_all on public.contacts for all to crm_owner using (true) with check (true);
create policy crm_owner_all on public.consents for all to crm_owner using (true) with check (true);
create policy crm_owner_all on public.events   for all to crm_owner using (true) with check (true);

-- ADR L16 + L40-L41: append-only, except when running as crm_owner (i.e. inside the
-- security definer functions below). No session variable: set_config cannot bypass it.
create or replace function public.block_update_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'crm_owner' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'append-only table %: % not allowed', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

-- ADR L40-L41. identifier = email (trim/lower) or WhatsApp E.164. Returns rows affected
-- (consents + events + contacts); 0 if not found.
-- Payload: T7b stored UTMs nested under 'utm'. On deletion the payload is FLATTENED to an
-- allowlist: lead_magnet_id, utm_source, utm_medium, utm_campaign, channel, text_version.
-- Everything else (utm_content, utm_term, the nested 'utm' object) is dropped.
create function public.delete_contact(identifier text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_contact_id uuid;
  v_pseudonym  uuid := pg_catalog.gen_random_uuid();
  v_n          int;
  v_total      int := 0;
begin
  select c.id into v_contact_id from public.contacts c
   where c.email = lower(btrim(identifier)) or c.whatsapp = btrim(identifier)
   limit 1;
  if not found then
    return 0;
  end if;

  update public.consents
     set contact_id = null, pseudonym_id = v_pseudonym
   where contact_id = v_contact_id;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  update public.events e
     set contact_id = null,
         payload = jsonb_strip_nulls(jsonb_build_object(
           'lead_magnet_id', e.payload -> 'lead_magnet_id',
           'channel',        e.payload -> 'channel',
           'text_version',   e.payload -> 'text_version',
           'utm_source',     coalesce(e.payload -> 'utm_source',   e.payload -> 'utm' -> 'utm_source'),
           'utm_medium',     coalesce(e.payload -> 'utm_medium',   e.payload -> 'utm' -> 'utm_medium'),
           'utm_campaign',   coalesce(e.payload -> 'utm_campaign', e.payload -> 'utm' -> 'utm_campaign')))
   where e.contact_id = v_contact_id;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- FKs are NO ACTION: references cleared above, now the contact can go.
  delete from public.contacts where id = v_contact_id;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  return v_total;
end;
$$;

-- ADR L38-L39: remove contacts inactive for 24 months. Returns contacts removed.
create function public.purge_inactive_contacts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_count int := 0;
begin
  for r in select c.email from public.contacts c
            where c.last_seen < pg_catalog.now() - interval '24 months'
  loop
    perform public.delete_contact(r.email);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Unsubscribe: records event only, never deletes the contact. Unknown identifier ->
-- returns silently with nothing written (same void result: no existence leak).
create function public.record_unsubscribe(identifier text, channel text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_contact_id uuid;
begin
  if channel is null or channel not in ('email', 'whatsapp') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;
  select c.id into v_contact_id from public.contacts c
   where c.email = lower(btrim(identifier)) or c.whatsapp = btrim(identifier)
   limit 1;
  if not found then
    return;
  end if;
  insert into public.events (contact_id, type, idempotency_key, payload)
  values (v_contact_id, 'unsubscribed',
          'unsubscribed:' || v_contact_id::text || ':' || channel,
          jsonb_build_object('channel', channel))
  on conflict (idempotency_key) do nothing;
end;
$$;

-- Ownership: ALTER OWNER requires membership in the new owner for non-superusers
-- (Supabase `postgres`). Grant temporarily, transfer, revoke, so no role stays a member.
grant crm_owner to current_user;
alter function public.delete_contact(text)              owner to crm_owner;
alter function public.purge_inactive_contacts()         owner to crm_owner;
alter function public.record_unsubscribe(text, text)    owner to crm_owner;
revoke crm_owner from current_user;

-- ADR L48: revoke before grant; service_role only.
revoke execute on function public.delete_contact(text)           from public, anon, authenticated;
revoke execute on function public.purge_inactive_contacts()      from public, anon, authenticated;
revoke execute on function public.record_unsubscribe(text, text) from public, anon, authenticated;
grant execute on function public.delete_contact(text)            to service_role;
grant execute on function public.purge_inactive_contacts()       to service_role;
grant execute on function public.record_unsubscribe(text, text)  to service_role;

-- ADR L39: monthly job, day 1 at 04:17 database time (UTC). Idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'crm_purge_inactive_contacts') then
    perform cron.unschedule('crm_purge_inactive_contacts');
  end if;
end;
$$;
select cron.schedule('crm_purge_inactive_contacts', '17 4 1 * *', 'select public.purge_inactive_contacts()');
