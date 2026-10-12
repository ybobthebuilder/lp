# ADR-0002 Amendment 1: States taxonomy, origin, redemption, schema details

- Status: Proposed
- Date: 2026-10-12
- Base: docs/adr/0002-behavioral-profiling-survey.md @ main 91d26d4
- Decisions by Fonseca on 2026-10-12. CLG execution (option 2) decided by Fonseca.

## M1. States taxonomy (amends D5)
- Pains/desires/objections are replaced by states P01–P10 + P99, each with `pole` ('dor'|'desejo'|'fomo'|'fud'):
  P01 Sobrecarga (dor), P02 Solidão (dor), P03 Defasagem (dor), P04 Alívio (desejo), P05 Protagonismo (desejo), P06 Atraso (fomo), P07 Ameaça (fomo), P08 Desconfiança (fud), P09 Responsabilização (fud), P10 Ceticismo (fud).
- The form shows the quoted phrase from Fonseca's message verbatim; trigger and "precisa de" are documentation only.
- A respondent selects 1 to 3 states. No intensity is collected.
- D01–D07/D99 and O01–O05/O99 are removed from v1.
- Research/publication (former D03), cost (former O04) and business growth (former D05) are excluded by Fonseca's decision on 2026-10-12; revisit in taxonomy v2.
- P99 follows D5 unchanged: code + free text up to 80 chars, PII-filtered, counted only by code.
- `artifact_ideas` free text max 280 chars, PII-filtered.

## M2. origin (amends D2, D8; removes item from Out of scope)
- Codes: L01 tracked post link, L03 organic/direct, L99 other. Forwarded-link attribution is excluded (not measurable without referral_codes, ADR-0003).
- Tracked links carry `?src=L01-<content code>`; content codes come from the taxonomy. The server accepts only the closed list; any other value is stored as L99; raw parameter text is never stored or logged.
- Stored on the contact at step 1 and on funnel_events.
- "Access-origin / tracked links as profile signal" is removed from Out of scope. Referral attribution stays in ADR-0003.

## M3. redeemed (amends D8, D9)
- `redeemed` boolean derived from events `artifact_redeemed`.
- D9 becomes: two idempotent upserts per person keyed on contact_ref, one at Finalizar and one at artifact_redeemed (updates `redeemed` only). Progress events never go to Zoho.

## M4. Zoho payload (replaces D8 custom field list)
Email, Mobile, Last_Name, Lead_Source (as in D8), plus custom fields: contact_ref, capsule_version, role, specialty, top_states (up to 3 P codes), dominant_pole, origin, redeemed, artifact_category, ai_interactions_day, steps_completed, taxonomy_version. Nothing else.
- dominant_pole = most frequent pole among selected states; ties broken by fixed order fud > fomo > dor > desejo.
- Lead_Source picklist must contain "unijungle-lp", verified by screenshot before T11d.

## M5. Schema
- A1. `consents.channel` check adds 'behavioral_profiling'. Marketing opt-in queries filter `channel in ('email','whatsapp')`.
- A2. Revocation via `revoke_profiling()`: writes events type='consent_revoked' (idempotency key), deletes the contact's profile rows, enqueues one Zoho delete. `events` may hold lead_captured, artifact_redeemed, unsubscribed, consent_revoked; never funnel steps.
- A3. `contacts.contact_ref uuid unique not null default gen_random_uuid()`, distinct from contacts.id and from the redemption code. `contacts.origin text check in ('L01','L03','L99')`, `contacts.origin_content text null` (closed taxonomy code only). delete_contact: enqueue Zoho delete by contact_ref; hard-delete profile_snapshots, profile_signals, artifact_ideas, artifact_ab_choices rows; remove pending upserts from zoho_outbox; then pseudonymize consents/events as today.
- A4. `zoho_outbox` holds no personal data: id, contact_ref, op ('upsert'|'delete'), status ('pending'|'sent'|'failed'), attempts, next_attempt_at, last_error (max 300 chars, never payload content), created_at, sent_at. No payload column: the capsule is built from contacts and profile tables at send time. Sent rows purged after 30 days; pending/failed deletes never purged.
- A5. Extended monthly job: add `delete from funnel_events where created_at < now() - interval '24 months'`.
- A6. profile_snapshots: id, contact_id, form_version, taxonomy_version, steps_completed, ai_interactions_day ('lt10'|'gte10'), created_at. profile_signals: snapshot_id, kind ('role'|'specialty'|'state'|'usage'), code, other_text (max 80, only for codes ending in 99). funnel_events: step (1–5), event ('view'|'advance'|'abandon'|'finish'), session_id, origin, origin_content, form_version, created_at (hour-truncated, server-set). artifact_ab_choices per D13. form_version 'f1'.

## M6. Execution
- Migrations run in the Supabase test project CLG by the implementer, with CLG-only credentials given privately by Fonseca; project id and credential scope verified in Supabase before any DDL. Never 1lp. Production apply stays with Fonseca.

## M7. Tests (in addition to T1–T6)
- T5 (extended): no contact-linked request (step 1, Finalizar, redeem) carries session_id, origin is stored on funnel_events only from the anonymous path, and funnel created_at is hour-truncated.
- T7. `?src=` containing an email or name stores L99 and leaves no raw text in any table.
- T8. More than 3 states per snapshot is rejected.
- T9. artifact_redeemed enqueues one upsert; a repeat redeem enqueues nothing new.
- T10. zoho_outbox has no payload column; a delete row carries only contact_ref, op and status.
- T11. funnel_events rows with synthetic created_at older than 24 months are deleted by the job; newer rows remain.
- T12. Marketing opt-in queries return no rows from channel 'behavioral_profiling'.
