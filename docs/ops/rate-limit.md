# Rate limit em POST /api/leads (T7g)

## Decisão
Limite por IP feito **na borda da Vercel (WAF Rate Limiting)**, não no código.
- Disponível em todos os planos, incluindo Hobby (1 regra de rate limit por projeto, Fixed Window, janela 10s–10min, chave IP, 1.000.000 requisições permitidas incluídas). Fonte: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- O IP é o que a própria Vercel determina na borda; o app não lê `x-forwarded-for`, então não há como falsificar o cabeçalho para burlar o limite. A Vercel sobrescreve `X-Forwarded-For` contra spoofing (https://vercel.com/docs/headers/request-headers#x-forwarded-for).
- Sem tabela nova, sem memória da função, sem IP gravado em log ou banco pelo app.

## Configuração (Fonseca, no painel da Vercel)
Projeto → **Firewall** → **Configure** → **+ New Rule**:
- **Name:** `leads-rate-limit`
- **If:** `Request Path` `equals` `/api/leads` **AND** `Method` `equals` `POST`
- **Then:** `Rate Limit`
  - Strategy: **Fixed Window**
  - Time Window: **60s**
  - Request Limit: **5**
  - Key: **IP**
  - Action: **Default (429)**  (opcional: começar com **Log** por 1 dia para observar)
- **Save Rule** → **Review Changes** → **Publish**.

Obs.: o publish aplica ao deployment de produção. O 429 chega ao front como 4xx; `submitLeadOnce` não repete 4xx e mostra "Não foi possível enviar agora".

## Verificação
Depois de publicar, rodar contra a URL de produção/preview protegida (dados sintéticos; o payload abaixo usa o honeypot preenchido, então **nada é gravado no banco**):

```bash
URL=https://<dominio>/api/leads
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL" \
    -H 'Content-Type: application/json' -d '{"hp_field":"check"}'
done
```
Esperado: as 5 primeiras `200`, as seguintes `429`. Em Firewall → overview, selecionar a regra e ver o tráfego bloqueado.

## Limites conhecidos
- Contadores são por região (pode passar do limite se o tráfego vier de várias regiões).
- Hobby: só 1 regra de rate limit por projeto.
