-- TASK-T7f: public.capture_lead refuses when the given email and whatsapp belong to two
-- DIFFERENT existing contacts. Nothing is written (no contact, consent, event, last_seen).
-- Same signature, return type, SECURITY INVOKER, search_path and grants as
-- 20261012050000_crm_capture_idempotent.sql (T7e); that migration is not modified.
-- Design:
--   * Advisory xact locks, taken before any contact select, always in this order:
--       1. 'capture_lead:'       || idempotency_key   (T7e, unchanged)
--       2. 'capture_lead:email:' || normalized email
--       3. 'capture_lead:wa:'    || normalized whatsapp
--     Distinct prefixes keep the three lock namespaces apart; the fixed order means two
--     calls can never wait on each other in a cycle (no 40P01).
--   * Same-key replay still returns the stored contact before the cross check (T7e).
--   * Cross check runs after all locks: email -> contact X, whatsapp -> contact Y, X <> Y
--     raises errcode 'LP001' with a fixed message carrying no PII. The route maps only
--     LP001 to its generic invalid-input 400.
--   * Unchanged: email-only match, whatsapp-only match, both matching the same contact.
create or replace function public.capture_lead(
  p_email text,
  p_whatsapp text,
  p_consent_text_version text,
  p_lead_magnet_slug text,
  p_utm jsonb,
  p_idempotency_key text
) returns uuid
language plpgsql
security invoker                       -- ADR L48
set search_path = ''
as $$
declare
  v_contact_id uuid;
  v_magnet_id  uuid;
  v_email_contact uuid;
  v_wa_contact    uuid;
begin
  -- ADR L29-L30: email, WhatsApp and consent text version are required.
  if coalesce(btrim(p_email), '') = '' then
    raise exception 'email is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_whatsapp), '') = '' then
    raise exception 'whatsapp is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_consent_text_version), '') = '' then
    raise exception 'consent_text_version is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;

  -- Fixed lock order (T7f): idempotency key, then email, then whatsapp; all before any
  -- contact select. Held until commit/rollback.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capture_lead:' || p_idempotency_key, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capture_lead:email:' || lower(btrim(p_email)), 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capture_lead:wa:' || btrim(p_whatsapp), 0));

  -- ADR L24: a retried call with the same key is a no-op.
  select e.contact_id into v_contact_id
    from public.events e where e.idempotency_key = p_idempotency_key;
  if found then
    return v_contact_id;
  end if;

  if p_lead_magnet_slug is not null then
    select m.id into v_magnet_id from public.lead_magnets m where m.slug = p_lead_magnet_slug;
    if not found then
      raise exception 'unknown lead_magnet_slug' using errcode = '22023';
    end if;
  end if;

  -- T7f: email and whatsapp of two different existing contacts -> refuse, write nothing.
  select c.id into v_email_contact from public.contacts c where c.email = lower(btrim(p_email));
  select c.id into v_wa_contact    from public.contacts c where c.whatsapp = btrim(p_whatsapp);
  if v_email_contact is not null and v_wa_contact is not null
     and v_email_contact <> v_wa_contact then
    raise exception 'capture_lead: identifiers belong to different contacts' using errcode = 'LP001';
  end if;

  -- ADR L23: existing email or WhatsApp only updates last_seen.
  for i in 1..2 loop
    select c.id into v_contact_id from public.contacts c
     where c.email = lower(btrim(p_email)) or c.whatsapp = btrim(p_whatsapp)
     order by (c.email = lower(btrim(p_email))) desc
     limit 1;
    if found then
      update public.contacts set last_seen = now() where id = v_contact_id;
      exit;
    end if;
    insert into public.contacts (email, whatsapp)
    values (lower(btrim(p_email)), btrim(p_whatsapp))
    on conflict do nothing
    returning id into v_contact_id;
    exit when v_contact_id is not null;
    -- Lost a race on email or whatsapp: loop once to pick up the committed row.
  end loop;
  if v_contact_id is null then
    raise exception 'capture_lead: contact not resolved' using errcode = '40001';
  end if;

  -- ADR L27-L29: both consents required, each with text_version.
  insert into public.consents (contact_id, channel, text_version) values
    (v_contact_id, 'email',    p_consent_text_version),
    (v_contact_id, 'whatsapp', p_consent_text_version);

  -- ADR L22, L24: lead_captured event, no PII in payload (ADR L49).
  insert into public.events (contact_id, type, idempotency_key, payload)
  values (v_contact_id, 'lead_captured', p_idempotency_key,
          jsonb_build_object('lead_magnet_id', v_magnet_id,
                             'utm', coalesce(p_utm, '{}'::jsonb)))
  on conflict (idempotency_key) do nothing;

  return v_contact_id;
end;
$$;

-- ADR L48: revoke before grant (re-applied explicitly).
revoke execute on function public.capture_lead(text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.capture_lead(text, text, text, text, jsonb, text)
  to service_role;

-- Fail the migration if anon/authenticated can execute capture_lead.
do $$
begin
  if has_function_privilege('anon', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute')
     or has_function_privilege('authenticated', 'public.capture_lead(text,text,text,text,jsonb,text)', 'execute') then
    raise exception 'anon/authenticated can execute capture_lead' using errcode = '42501';
  end if;
end;
$$;
