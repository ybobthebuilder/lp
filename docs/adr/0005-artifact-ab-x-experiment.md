# ADR-0005: Artifact A/B/X experiment

- Status: Proposed
- Date: 2026-10-15
- Deciders: Fonseca (owner); pipeline vote under D-014 for this doc only
- Repo: ybobthebuilder/lp
- Depends on: ADR-0002 (profiling survey), `docs/taxonomy/v1.md`

## Context
Fonseca prefers not to predefine user labels that could limit creativity. Instead, each artifact offer is tested in three arms. The system infers a working impression of the user (logical, mathematical, creative) from forms and artifact interaction, never as a fixed label shown to the user. Brand stance: welcoming care, not toxic productivity.

## Decisions

D-009. Assignment. Fixed per person by `contact_ref` hash: A 40%, B 40%, X 20%. A person never changes arm.
- A (safe): logical or mathematical artifact, linear path (Bayesian update with anchored Monte Carlo).
- B (creative): logical or mathematical plus creative framing.
- X (autonomy): the user explores; the team learns from new approaches that work and from errors repeated among peers (divergent to convergent).

D-010. Metrics.
- Primary: `redeemed` (artifact redemption).
- Secondary: return within 30 days.
- Guard: opt-out rate per arm. A guard breach pauses the arm (threshold: UNKNOWN, to be set by Fonseca).

D-011. Storage of `arm`. PROPOSED: column in `artifact_ab_choices`, not in `funnel_events` (explorer recommendation; `funnel_events` stays anonymous per ADR-0002 D2). Requires an ADR-0002 amendment. CONTESTED until Mestre/Fonseca close it.

D-012. Consent and LGPD.
- Assignment and telemetry run only for contacts with the `behavioral_profiling` consent (ADR-0002 D3). Without it: arm A, no telemetry.
- No raw free text enters analysis or any model (D-016).
- A RIPD (LGPD impact report) draft is required before launch: see "RIPD draft" below.

D-013. Artifact rules. The artifact selection rules formerly drafted in `docs/taxonomy/artifact-rules.v1.md` (removed in PR #25) live here. Rules 14 and 15 note: their (a)/(b) ordering is void under A/B/X; each arm applies its own path.

## Pre-registration
Fixed before any data is read:
- Hypothesis: B or X has a higher `redeemed` rate than A.
- Unit: person (`contact_ref`). Analysis: per arm, intention-to-treat.
- Minimum sample size: UNKNOWN (needs baseline `redeemed` rate). No stopping on peeking.
- Changes after start are logged as amendments with date.

## RIPD draft (outline)
- Data: closed codes from taxonomy v1, arm, redemption and return events.
- Purpose: personalize artifacts; legal basis: consent.
- Retention: as ADR-0002 D10 (24 months).
- Third parties: none for analysis. Zoho receives only the ADR-0002 D8 capsule.
- Risks and mitigations: re-identification from small cells (report only cells >= UNKNOWN n).

## Out of scope
Migrations, schema changes, and launching the experiment. Those need Fonseca.
