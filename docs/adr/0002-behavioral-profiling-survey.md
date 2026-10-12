# ADR-0002: Behavioral profiling survey and Zoho CRM capsule

- Status: Proposed
- Date: 2026-10-12
- Deciders: Fonseca (owner); reviewed by reviewer v.0.0.1
- Repo: ybobthebuilder/lp (production on unijungle.com via Vercel/Next)

## Context
The lp landing page stays open long-term to profile visitors and deliver a lead-magnet artifact. Structured answers must let us find common pains, states and probabilities (prevalence) to define congress themes and simple artifacts.
Existing VERIFIED migrations in `supabase/migrations`: `20261012030000_crm_core`, `20261012040000_crm_deletion_retention`, `20261012050000_crm_capture_idempotent`, `20261012060000_crm_capture_refuse_cross`.
metaciencia (Lovable) is visual reference only; it is not a data source.

## Decisions

D1. Source of truth: Supabase project 1lp. Zoho CRM is a downstream copy of a minimal capsule only.

D2. Contact vs funnel separation (option a, Fonseca).
- Step 1 sends contact + consents via `/api/leads`; `events` gets `lead_captured`.
- Steps 2–5 write ONLY to anonymous `funnel_events`. Answers are persisted to profile tables at "Finalizar" (end of step 5).
- `events` (contact-linked) gets only `lead_captured` and `artifact_redeemed` (if redeemed).
- Contact-linked requests (step 1, Finalizar, redeem) never carry `session_id`.
- `funnel_events.created_at` defaults to `date_trunc('hour', now())`, set server-side; the API ignores any client-supplied timestamp.
- Single route `/api/leads` (keeps rate limit + honeypot). It never logs the request body.

D3. Consent: email and WhatsApp consents are mandatory (Fonseca decision). Profile storage requires the `behavioral_profiling` purpose; refusing it stores no profile.

D4. Specialty list: CFM Resolution 2.380/2024 (55 specialties, VERIFIED), coded S01–S55 by official number, plus S00 (not applicable) and S99 (other). Areas of practice are out of v1. Re-check the CFM norms page before merging T11b.

D5. No raw text for analysis. Closed codes only (taxonomy v1, `docs/taxonomy/v1.md`): role R01–R05/R99; specialty as D4; pains P01–P10/P99 (validated by Fonseca); desires D01–D07/D99; objections O01–O05/O99; usage patterns U01–U07/U99; AI interactions per day `lt10`/`gte10`; artifact category A01–A07/A99. "Other" = code 99 + free text up to 80 chars, PII-filtered, counted only by code.

D6. Step-2 notice (verbatim): "Usamos só para personalizar sua jornada. Não cole dados pessoais ou de pacientes."

D7. Flow: 5 steps; step 1 contact + consents; steps 2–5 profile questions; step 5 ends with "Finalizar" and the artifact screen (`wa.me` link with a random, single-use, expiring redemption code).

D8. Zoho payload (closed list, nothing else): `Email`, `Mobile`, `Last_Name` = "unijungle-" + first 8 chars of `contact_ref`, `Lead_Source` = "unijungle-lp", and custom fields `contact_ref`, `capsule_version`, `role`, `specialty`, `top_pains`, `top_desires`, `top_objection`, `artifact_category`, `ai_interactions_day`, `steps_completed`, `taxonomy_version`. Custom field API names must be VERIFIED (screenshot from Fonseca) before T11d; unverified names = UNKNOWN, stop.

D9. Zoho: US data center (`zohoapis.com`), Free Edition, Leads module only. One idempotent upsert per person at Finalizar, keyed on `contact_ref`, via `zoho_outbox` with retry and backoff. Progress events never go to Zoho. Token minimal scope, stored only in Vercel env vars. Signup succeeds even if Zoho is down.

D10. Deletion and retention.
- `delete_contact` deletes `profile_snapshots`, `profile_signals`, `artifact_ideas` and A/B records for the contact, removes pending upserts from `zoho_outbox`, and enqueues one Zoho delete.
- Revoking `behavioral_profiling` deletes the profile and the Zoho capsule.
- The monthly 24-month inactivity job covers `profile_snapshots`, `profile_signals`, `artifact_ideas`, `funnel_events`, `zoho_outbox` and A/B records.

D11. Analysis: SQL computes; the LLM receives only aggregates and every number cites a view. Wording "entre os respondentes", with n and Wilson 95% interval. Groups with n < 10 are excluded. Monthly cohorts. Taxonomy, consent text and form are versioned.

D12. `/privacidade` declares, before the first Zoho send: Zoho as operator (USA, LGPD art. 33), the anonymous funnel, and "logs técnicos (incluindo IP) retidos por até 1 dia pelo operador Vercel". Observability Plus stays off; enabling it or adding a log drain requires a new ADR and a `/privacidade` update.

D13. A/B artifact. The server picks 2 candidate artifacts from taxonomy codes using a versioned rule table (no AI at request time) and randomizes display order. With `behavioral_profiling` consent only, it stores `variant_a`, `variant_b`, display order, choice, `rule_version`, `taxonomy_version`; no free text. The choice is a coded signal. A view of choice rate per segment informs human rule updates. Zoho receives only the chosen artifact code.

## Out of scope (future ADRs)
- Access-origin / tracked links as profile signal (ADR-0003, attribution).
- Reading inboxes (email/WhatsApp) to predict artifacts: own ADR, own consent, `/privacidade` line, retention.
- WhatsApp bot (Meta Cloud API, dedicated number).
- Zoho modules other than Leads.

## Required tests (CLG project)
T1. Refused `behavioral_profiling` consent stores no profile rows.
T2. Revocation deletes the profile and enqueues a Zoho delete.
T3. `delete_contact` covers all new tables with the expected counts and clears pending `zoho_outbox` upserts.
T4. Invalid JSON returns 400 and writes nothing.
T5. Contact-linked requests carry no `session_id`; funnel `created_at` is hour-truncated and ignores client time.
T6. The 24-month job removes expired rows from all new tables.

## Tasks
| ID | Task | Depends on |
|---|---|---|
| T11a | Migrations (CLG), deletion + retention | ADR PASS |
| T11b | Taxonomy v1 + step-2 metaprompt | ADR PASS |
| T11c | 5-step form, funnel, visual port | T11a, T11b |
| T11d | Capsule + `zoho_outbox`; token created here | T11c, Zoho fields VERIFIED |
| T11e | `/privacidade` update | live before T11d in production |
| T11f | Analysis views | T11c |
| T11g | LLM report | T11f |
