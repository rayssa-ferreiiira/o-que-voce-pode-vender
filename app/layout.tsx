import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "O que você pode vender?",
  description: "Descubra o que você pode vender a partir da experiência que já tem, no trabalho e fora dele.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F6F0E6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
