# ADR-0001: Behavioral CRM for leads

- Status: Accepted (storage, retention and WhatsApp decided by Fonseca on 2026-10-12); items marked UNKNOWN are still open
- Date: 2026-10-12
- Scope: `ybobthebuilder/lp` lead capture (`/api/leads`) and the data behind it

## Context

`/api/leads` currently validates the email and only writes UTMs to `console.log`; leads are not stored. The funnel needs a place to keep each lead, their consent and what they did, so later steps (email with the lead magnet, WhatsApp, stages) can build on it. The repository is public, so no lead data may ever be committed.

## Decisions

### Storage
- Postgres on Supabase is the source of truth.
- Tables: `contacts`, `consents`, `events`, `lead_magnets`.
- `consents` and `events` are append-only (insert only, no update).
- `events` is append-only except for anonymization on deletion, performed only by a server-side function.
- `contacts` can be updated (`last_seen`, stage, score) and deleted (deletion requests).
- Column definitions: UNKNOWN, defined in TASK-T7b (migration).

### Writing a lead
- The API route calls one Postgres function, `capture_lead` (PROPOSED name), via `fetch` to `/rest/v1/rpc/capture_lead`. No new npm dependency.
- The function writes contact, consents and the `lead_captured` event in a single transaction.
- A duplicate email or WhatsApp updates `last_seen` on the existing contact instead of creating a new one.
- Every event carries an idempotency key so retries do not create duplicates.

### Consent (LGPD)
- Separate, explicit consent per channel: `email` and `whatsapp`. Nothing pre-checked.
- Each consent stores the date/time and the `text_version` of the consent text shown.
- Required consent (PROPOSED, pending Fonseca): `email` is required, because the lead magnet is delivered by email. `whatsapp` is optional; if a WhatsApp number is provided, its own consent is required.
- The API rejects a submission without the required consent.

### Stages and score
- Stages are deterministic and versioned: `visitor` → `lead` → `engaged` → `qualified` → `customer`.
- Score rules are versioned with the stages.
- Transition criteria and score values: UNKNOWN, to be defined by Fonseca.

### Retention and deletion
- Contacts with 24 months without activity are removed. Activity = the `last_seen` column.
- Mechanism that runs the 24-month removal: UNKNOWN.
- Deletion = delete the contact and anonymize their events.
- `consents` on deletion (PROPOSED, pending Fonseca): records are kept as proof of consent, with the link to the contact replaced by an irreversible identifier (hash) and no email or phone.
- No raw IP address is stored.

### Security
- Environment variables, server only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`sb_secret_...`). Never with the `NEXT_PUBLIC_` prefix. Legacy `anon` / `service_role` keys are not used.
- The secret key goes in the `apikey` header, not `Authorization: Bearer`.
- RLS enabled on every table; table grants only to `service_role`; no grants to `anon`.
- `capture_lead`: `revoke execute ... from public, anon, authenticated` before `grant execute ... to service_role`; `security invoker` (or `security definer` with `set search_path = ''` and fully qualified table names).
- No phone, email or other lead data in logs, fixtures or the repository. Tests use synthetic data only.

## Consequences
- TASK-T7b creates the migration and must prove that a call to `/rest/v1/rpc/capture_lead` with the publishable key is refused (401/403) and one with the secret key is accepted, on a test project with synthetic data.
- TASK-T7c changes `/api/leads` to validate email and WhatsApp (E.164, `+55`), require consent per channel and call `capture_lead`; adds `.env.example` with variable names only.
- The form with WhatsApp returns together with the privacy page (TASK-T6a) and TASK-T7c.
