import type { Metadata } from "next";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "Coco Hemi",
  description: "Editor social com filtros locais e IA para fotos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

