-- TASK-T7b: CRM core (contacts, consents, events, lead_magnets) + capture_lead.
-- Source: docs/adr/0001-behavioral-crm.md @ 424a3db. Line refs below are "ADR Lnn".
-- Column definitions are PROPOSED (ADR L18: "Column definitions: UNKNOWN, defined in TASK-T7b").
-- Synthetic data only; no PII, URLs or keys in this file (ADR L49).

create extension if not exists pgcrypto with schema extensions;

-- ADR L15, L17: contacts is mutable (last_seen, stage, score) and deletable.
create table public.contacts (
  id             uuid primary key default gen_random_uuid(),            -- PROPOSED
  email          text not null unique,                                   -- PROPOSED; ADR L29 (required)
  whatsapp       text not null unique
                 check (whatsapp ~ '^\+55[0-9]{10,11}$'),                -- PROPOSED; ADR L29, L53 (E.164 +55)
  stage          text not null default 'lead'
                 check (stage in ('visitor','lead','engaged','qualified','customer')), -- PROPOSED; ADR L33
  stage_version  text,                                                   -- PROPOSED; ADR L33 (versioned)
  score          int,                                                    -- PROPOSED; ADR L34
  score_version  text,                                                   -- PROPOSED; ADR L34
  created_at     timestamptz not null default now(),                     -- PROPOSED
  last_seen      timestamptz not null default now()                      -- PROPOSED; ADR L23, L38
);
-- ADR L42: no IP column in any table.

create table public.lead_magnets (                                       -- ADR L15
  id          uuid primary key default gen_random_uuid(),               -- PROPOSED
  slug        text not null unique,                                      -- PROPOSED
  title       text not null,                                             -- PROPOSED
  created_at  timestamptz not null default now()                         -- PROPOSED
);

-- ADR L15, L16 (append-only), L27-L28 (per channel, date/time, text_version), L41 (pseudonym_id).
create table public.consents (
  id            uuid primary key default gen_random_uuid(),              -- PROPOSED
  contact_id    uuid null references public.contacts(id),                -- PROPOSED; null after pseudonymization (ADR L41)
  pseudonym_id  uuid null,                                               -- PROPOSED; ADR L41
  channel       text not null check (channel in ('email','whatsapp')),   -- PROPOSED; ADR L27
  granted_at    timestamptz not null default now(),                      -- PROPOSED; ADR L28
  text_version  text not null                                            -- PROPOSED; ADR L28
);

-- ADR L15, L16 (append-only), L24 (idempotency key). payload must not contain PII (ADR L49).
create table public.events (
  id               uuid primary key default gen_random_uuid(),           -- PROPOSED
  contact_id       uuid null references public.contacts(id),             -- PROPOSED; null after anonymization (ADR L40)
  type             text not null,                                        -- PROPOSED
  idempotency_key  text not null unique,                                 -- PROPOSED; ADR L24
  payload          jsonb not null default '{}'::jsonb,                   -- PROPOSED; no PII (ADR L49)
  created_at       timestamptz not null default now()                    -- PROPOSED
);

-- ADR L16: consents/events append-only. The pseudonymization/anonymization
-- exception (server-side deletion function) is out of scope for T7b; it will
-- have to relax this trigger in its own task.
create function public.block_update_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'append-only table %: % not allowed', tg_table_name, tg_op
    using errcode = '42501';
end $$;

create trigger consents_append_only before update or delete on public.consents
  for each row execute function public.block_update_delete();
create trigger events_append_only before update or delete on public.events
  for each row execute function public.block_update_delete();

-- ADR L47: RLS on every table, no policies; table grants only to service_role, none to anon.
alter table public.contacts     enable row level security;
alter table public.consents     enable row level security;
alter table public.events       enable row level security;
alter table public.lead_magnets enable row level security;

revoke all on public.contacts, public.consents, public.events, public.lead_magnets
  from public, anon, authenticated;
grant select, insert, update, delete on public.contacts, public.lead_magnets to service_role;
grant select, insert on public.consents, public.events to service_role;
revoke all on function public.block_update_delete() from public, anon, authenticated;

-- ADR L21-L24, L29-L30, L48.
create function public.capture_lead(
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

  -- ADR L23: existing email or WhatsApp only updates last_seen.
  select c.id into v_contact_id from public.contacts c
   where c.email = lower(btrim(p_email)) or c.whatsapp = btrim(p_whatsapp)
   order by (c.email = lower(btrim(p_email))) desc
   limit 1;
  if found then
    update public.contacts set last_seen = now() where id = v_contact_id;
  else
    insert into public.contacts (email, whatsapp)
    values (lower(btrim(p_email)), btrim(p_whatsapp))
    returning id into v_contact_id;
  end if;

  -- ADR L27-L29: both consents required, each with text_version.
  insert into public.consents (contact_id, channel, text_version) values
    (v_contact_id, 'email',    p_consent_text_version),
    (v_contact_id, 'whatsapp', p_consent_text_version);

  -- ADR L22, L24: lead_captured event, no PII in payload (ADR L49).
  insert into public.events (contact_id, type, idempotency_key, payload)
  values (v_contact_id, 'lead_captured', p_idempotency_key,
          jsonb_build_object('lead_magnet_id', v_magnet_id,
                             'utm', coalesce(p_utm, '{}'::jsonb)));

  return v_contact_id;
end $$;

-- ADR L48: revoke before grant.
revoke execute on function public.capture_lead(text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.capture_lead(text, text, text, text, jsonb, text)
  to service_role;
