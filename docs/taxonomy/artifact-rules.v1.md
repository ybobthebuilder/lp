# Regras de artefato A/B — v1 (D13)

- rule_version: `v1`
- taxonomy_version: `v1`
- Status: PROPOSED (todas as regras dependem de aprovação do Fonseca)
- Códigos usados: role (R), estados (P01–P10), usage (U), `ai_interactions_day = gte10`. Nenhum código D/O (removidos pela Emenda 1).

## Algoritmo (determinístico, sem IA no request)
1. Avaliar as regras em ordem de prioridade crescente; a primeira que casa define `variant_a` e `variant_b`. "Estados contém Pxx" = Pxx está entre os 1–3 estados marcados, independentemente da ordem de marcação.
2. Se nenhuma regra casar, usar o fallback (prioridade 99). `variant_a != variant_b` em todas as linhas.
3. A ordem de exibição é randomizada no servidor e gravada; a escolha vira sinal codificado.
4. Grava-se só com consentimento `behavioral_profiling`: `variant_a`, `variant_b`, ordem, escolha, `rule_version`, `taxonomy_version`. Zoho recebe só o código escolhido.

## Tabela
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
