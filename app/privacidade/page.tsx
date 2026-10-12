import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_TEXT_UPDATED_AT, CONSENT_TEXT_VERSION } from "../consent-version";

export const metadata: Metadata = {
  title: "Política de privacidade",
};

export default function Privacidade() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-bold text-coral hover:underline">← Voltar</Link>
      <h1 className="mt-6 text-4xl font-black tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-sm text-neutral-500">Versão {CONSENT_TEXT_VERSION}, atualizada em {CONSENT_TEXT_UPDATED_AT}</p>
      <div className="mt-8 space-y-6 leading-7 text-neutral-700">
        <section>
          <h2 className="text-xl font-black text-ink">Controlador</h2>
          <p>CNPJ 42.380.117/0001-98. Contato: <a href="mailto:ola@unijungle.com" className="font-bold text-coral hover:underline">ola@unijungle.com</a>.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-ink">Finalidade</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Entregar material educativo de apoio.</li>
            <li>Enviar conteúdos relacionados por email (1x por semana).</li>
            <li>Enviar alertas por WhatsApp. O bot de WhatsApp é usado para personalizar a experiência.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-black text-ink">Prazo de guarda</h2>
          <p>24 meses sem atividade, ou até um pedido de exclusão, o que acontecer primeiro.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-ink">Onde ficam os dados</h2>
          <p>No Supabase, com acesso só pelo servidor.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-ink">Pedidos de acesso ou exclusão</h2>
          <p><a href="mailto:ola@unijungle.com" className="font-bold text-coral hover:underline">ola@unijungle.com</a></p>
        </section>
      </div>
    </main>
  );
}
