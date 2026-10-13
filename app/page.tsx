"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Download, Sparkles } from "lucide-react";
import { submitLeadOnce } from "./lead-submit";
import { HONEYPOT_FIELD, HoneypotField } from "./honeypot";

function track(event: string, data: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("lead_event", { detail: { event, ...data } }));
  // Compatible with GA4/GTM if a dataLayer is installed later.
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer?.push({ event, ...data });
}

function getUtm() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((key) => [key, params.get(key) || ""]));
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [hp, setHp] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { track("page_view", getUtm()); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);
    track("form_submit_start");
    try {
      const ok = await submitLeadOnce({ email, whatsapp, consent_email: consentEmail, consent_whatsapp: consentWhatsapp, [HONEYPOT_FIELD]: hp, ...getUtm() });
      if (ok) {
        setSubmitted(true);
        track("lead_captured", getUtm());
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <a href="#top" className="font-black tracking-tight text-mist">build<span className="text-lava">/</span>in public</a>
        <a href="#receba" className="hidden rounded-full border border-moss px-5 py-2 text-sm font-bold text-mist transition hover:border-lava hover:bg-lava hover:text-fur sm:block">Quero o checklist <ArrowRight className="ml-2 inline h-4 w-4" /></a>
      </nav>

      <section id="top" className="canopy-field relative overflow-hidden px-6 pb-24 pt-12 sm:pt-20">
        <div className="godrays pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-canopy px-4 py-2 text-sm font-bold text-mist"><Sparkles className="h-4 w-4 text-lava" /> Material gratuito para quem constrói</div>
            <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.05em] text-mist sm:text-7xl">Valide sua ideia em <span className="text-lava">7 dias.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-mist/80">Um checklist direto para sair da ideia, conversar com pessoas reais e escolher o que construir primeiro — sem passar meses no escuro.</p>
            <a href="#receba" onClick={() => track("cta_click", { placement: "hero" })} className="mt-9 inline-flex items-center rounded-full bg-lava px-7 py-4 font-bold text-fur transition hover:-translate-y-1 hover:bg-mist">Receber o checklist <ArrowRight className="ml-3 h-5 w-5" /></a>
            <p className="mt-4 text-sm text-mist/70">Grátis. Sem spam. Feito por quem está construindo em público.</p>
          </div>
          <div className="relative mx-auto w-full max-w-md rounded-3xl border border-moss/60 bg-canopy p-7 text-mist shadow-soft">
            <div className="mb-10 flex items-center justify-between border-b border-dashed border-moss/50 pb-5"><span className="font-black">7 DIAS</span><span className="rounded-full bg-lava px-3 py-1 text-xs font-black text-fur">CHECKLIST</span></div>
            <p className="text-3xl font-black leading-tight">Da ideia ao primeiro experimento.</p>
            <div className="mt-8 space-y-4 text-sm font-semibold">{["Defina o problema real", "Encontre suas primeiras conversas", "Escreva uma proposta clara", "Teste antes de construir", "Escolha o próximo passo"].map((item) => <div key={item} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-moss text-night"><Check className="h-4 w-4" /></span>{item}</div>)}</div>
            <div className="mt-10 text-right text-xs font-bold uppercase tracking-[.2em] text-lava">feito para começar</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24"><div className="grid gap-10 md:grid-cols-3"><div><p className="text-sm font-black uppercase tracking-widest text-lava">O problema</p><h2 className="mt-3 text-3xl font-black tracking-tight text-mist">Construir não é o primeiro passo.</h2></div><p className="leading-7 text-mist/80">A vontade é abrir o editor e começar a codar. Mas uma semana de conversas pode poupar meses criando algo que ninguém pediu.</p><p className="leading-7 text-mist/80">Este material é o caminho mais curto entre “tenho uma ideia” e “aprendi algo com usuários reais”.</p></div></section>

      <section id="receba" className="bg-canopy px-6 py-20 text-mist"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-widest text-lava">Seu próximo experimento começa aqui</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Quer receber o checklist?</h2>{submitted ? <div className="mx-auto mt-10 max-w-md rounded-2xl bg-night p-7 text-left text-mist"><div className="flex items-center gap-3 text-lg font-black"><Check className="rounded-full bg-moss p-1 text-night" /> Tudo certo!</div><p className="mt-3 text-mist/80">Seu material está pronto para baixar.</p><a href="/checklist-validacao-7-dias.pdf" download onClick={() => track("lead_magnet_download")} className="mt-5 inline-flex items-center font-bold text-lava hover:underline"><Download className="mr-2 h-4 w-4" /> Baixar o checklist</a></div> : <form onSubmit={submit} className="relative mx-auto mt-9 flex max-w-lg flex-col gap-3"><HoneypotField value={hp} onChange={setHp} /><label htmlFor="email" className="sr-only">Seu melhor e-mail</label><input id="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu melhor e-mail" className="min-h-14 rounded-full bg-mist px-6 text-fur outline-none ring-lava focus:ring-2" /><label htmlFor="whatsapp" className="sr-only">Seu WhatsApp</label><input id="whatsapp" required type="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="seu WhatsApp com DDD" className="min-h-14 rounded-full bg-mist px-6 text-fur outline-none ring-lava focus:ring-2" /><label className="flex items-start gap-2 text-left text-sm text-mist"><input type="checkbox" required checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} className="mt-1 accent-lava" /> Aceito receber conteúdos por e-mail.</label><label className="flex items-start gap-2 text-left text-sm text-mist"><input type="checkbox" required checked={consentWhatsapp} onChange={(e) => setConsentWhatsapp(e.target.checked)} className="mt-1 accent-lava" /> Aceito receber alertas por WhatsApp.</label><button disabled={loading} className="min-h-14 rounded-full bg-lava px-7 font-black text-fur transition hover:bg-mist disabled:opacity-60">{loading ? "Enviando..." : "Quero receber"}</button></form>}{error && !submitted && <p role="alert" className="mt-4 text-sm font-bold text-lava">Não foi possível enviar agora. Tente de novo.</p>}<p className="mt-5 text-sm text-mist/75">Ao enviar, você concorda em receber o material. Você pode sair quando quiser. <a href="/privacidade" className="text-lava underline hover:text-mist">Política de privacidade</a>.</p></div></section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-mist/60 sm:flex-row sm:justify-between"><span>© 2026 build/in public</span><span>Uma jornada aberta, um experimento por vez.</span></footer>
    </main>
  );
}
