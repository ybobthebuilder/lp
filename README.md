# Build/in public — landing page

Landing page em Next.js + Tailwind para capturar leads e entregar o checklist “Valide sua ideia em 7 dias”.

## Rodar localmente

```bash
npm install
npm run dev
```

## Rastreamento

A página preserva `utm_source`, `utm_medium`, `utm_campaign` e `utm_content`, dispara eventos (`page_view`, `cta_click`, `lead_captured`, `lead_magnet_download`) e envia esses dados para `/api/leads`. Para produção, conecte a rota a Supabase (persistência) e Resend (entrega por e-mail), e adicione Google Tag Manager/GA4 ou Plausible.

Exemplo:

```text
/?utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public&utm_content=post-01
```

## Próximos passos

1. Adicionar `public/checklist-validacao-7-dias.pdf`.
2. Substituir o `console.log` da API por persistência e envio de e-mail.
3. Adicionar política de privacidade e consentimento LGPD.
4. Publicar na Vercel e configurar domínio.
