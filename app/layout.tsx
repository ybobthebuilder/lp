import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valide sua ideia em 7 dias",
  description: "Um checklist prático para transformar uma ideia em um primeiro experimento real.",
  openGraph: {
    title: "Valide sua ideia em 7 dias",
    description: "Comece a construir com clareza, não no escuro.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
