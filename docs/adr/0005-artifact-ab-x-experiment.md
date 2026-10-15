# ADR-0005: Artifact A/B/X experiment

- Status: Proposed
- Date: 2026-10-15
- Deciders: Fonseca (owner); pipeline vote under D-014 for this doc only
- Repo: ybobthebuilder/lp
- Depends on: ADR-0002 (profiling survey), `docs/taxonomy/v1.md`

## Context
Fonseca prefers not to predefine user labels that could limit creativity. Instead, each artifact offer is tested in three arms (D-009). Brand stance: welcoming care, not toxic productivity.

PROPOSED (no D-xxx yet): the system infers a working impression of the user (logical, mathematical, creative) from forms and artifact interaction, never shown to the user as a label. This inference is personal-data processing and is listed in the RIPD.

## Decisions

D-009. Assignment. Fixed per person by `contact_ref` hash: A 40%, B 40%, X 20%. A person never changes arm.
- A (safe): logical or mathematical artifact. PROPOSED (no D-xxx yet): linear path (Bayesian update with anchored Monte Carlo).
- B (creative): logical or mathematical plus creative framing.
- X (autonomy): the user explores; the team learns from new approaches that work and from errors repeated among peers (divergent to convergent).

D-010. Metrics.
- Primary: `redeemed` (artifact redemption).
- Secondary: return within 30 days.
- Guard: opt-out rate per arm. A guard breach pauses the arm (threshold: UNKNOWN, to be set by Fonseca).

D-011. Storage of `arm`. PROPOSED: column in `artifact_ab_choices`, not in `funnel_events` (explorer recommendation; `funnel_events` stays anonymous per ADR-0002 D2). Requires an ADR-0002 amendment. CONTESTED until Mestre/Fonseca close it.

D-012. Consent and LGPD.
- Assignment and telemetry run only for contacts with the `behavioral_profiling` consent (ADR-0002 D3). Contacts without it get the default artifact, are not assigned an arm, and are excluded from the analysis population.
- No raw free text enters analysis or any model (D-016).
- A RIPD (LGPD impact report) draft is required before launch: see "RIPD draft" below.

D-013. Artifact rules. The selection rules formerly in `docs/taxonomy/artifact-rules.v1.md` (removed in PR #25; source `42e985f`) live here, unchanged, all PROPOSED. Note on rules 14 and 15: they only fire when the marked state is only P99.

### Algoritmo (determinístico, sem IA no request)
1. Avaliar as regras em ordem de prioridade crescente; a primeira que casa define `variant_a` e `variant_b`. "Estados contém Pxx" = Pxx está entre os 1–3 estados marcados, independentemente da ordem de marcação.
2. Se nenhuma regra casar, usar o fallback (prioridade 99). `variant_a != variant_b` em todas as linhas.
3. A ordem de exibição é randomizada no servidor e gravada; a escolha vira sinal codificado.
4. Grava-se só com consentimento `behavioral_profiling`: `variant_a`, `variant_b`, ordem, escolha, `rule_version`, `taxonomy_version`. Zoho recebe só o código escolhido.

### Tabela
| Prioridade | Condição (códigos) | variant_a | variant_b | Base ("precisa de") | Status |
|---|---|---|---|---|---|
| 1 | role = R02 | A06 | A01 | perfil estudante | PROPOSED |
| 2 | role = R05 | A07 | A04 | perfil gestor | PROPOSED |
| 3 | role = R04 | A04 | A05 | perfil empreendedor | PROPOSED |
| 4 | estados contém P09 | A02 | A01 | limites claros do que é seguro e do que é proibido | PROPOSED |
| 5 | estados contém P08 | A02 | A01 | método de verificação, ceticismo estruturado | PROPOSED |
| 6 | estados contém P10 | A02 | A01 | evidência, honestidade sobre limitações | PROPOSED |
| 7 | estados contém P01 | A04 | A01 | menos tempo de tela, sem perder a segurança documental | PROPOSED |
| 8 | estados contém P04 | A04 | A01 | ganho de tempo concreto e mensurável | PROPOSED |
| 9 | estados contém P06 | A01 | A02 | primeiro passo pequeno e sem constrangimento | PROPOSED |
| 10 | estados contém P02 | A01 | A02 | segunda opinião confiável na hora | PROPOSED |
| 11 | estados contém P03 | A03 | A01 | síntese curada e com fonte | PROPOSED |
| 12 | estados contém P05 | A01 | A07 | domínio prático e um caminho para mostrar isso | PROPOSED |
| 13 | estados contém P07 | A04 | A01 | vantagem competitiva clara e aplicável já | PROPOSED |
| 14 | usage = U07 | A01 | A02 | ainda não usa IA | PROPOSED |
| 15 | ai_interactions_day = gte10 | A04 | A01 | uso intenso | PROPOSED |
| 99 | fallback (inclui só P99) | A01 | A02 | — | PROPOSED |

## Pre-registration
Fixed before any data is read:
- Hypothesis: B or X has a higher `redeemed` rate than A.
- Population: only contacts with `behavioral_profiling` consent.
- Unit: person (`contact_ref`). Analysis: per arm, intention-to-treat.
- Test: two comparisons (B vs A, X vs A); statistical test and multiplicity correction UNKNOWN, to be fixed before launch.
- Minimum sample size: UNKNOWN (needs baseline `redeemed` rate). No stopping on peeking.
- Changes after start are logged as amendments with date.

## RIPD draft (outline)
- Data: closed codes from taxonomy v1, arm, redemption and return events, and the inferred working impression (logical, mathematical, creative).
- Purpose: personalize artifacts; legal basis: consent.
- Retention: as ADR-0002 D10 (24 months).
- Third parties: none for analysis. Zoho receives only the ADR-0002 D8 capsule.
- Risks and mitigations: re-identification from small cells (report only cells >= UNKNOWN n).

## Out of scope
Migrations, schema changes, and launching the experiment. Those need Fonseca.
