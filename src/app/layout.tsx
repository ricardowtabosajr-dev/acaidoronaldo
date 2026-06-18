import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Açaí do Ronaldo - O Verdadeiro Açaí Natural",
  description: "Peça seu açaí natural batido na hora, Grosso ou Médio, em recipientes de 1L ou 500ml. Rápido, fresco e saboroso!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
