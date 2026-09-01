import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Solar Energie — Pré-étude photovoltaïque",
    template: "%s | Solar Energie",
  },
  description:
    "Préparez vos pré-études photovoltaïques plus rapidement : import de facture, données PVGIS, comparaison de scénarios et rapport PDF white-label.",
  keywords: [
    "photovoltaïque",
    "pré-étude solaire",
    "simulateur photovoltaïque",
    "installateur photovoltaïque",
    "PVGIS",
    "Solar Energie Pro",
  ],
  applicationName: "Solar Energie",
  openGraph: {
    title: "Solar Energie — Pré-étude photovoltaïque",
    description:
      "Un outil de pré-étude photovoltaïque pensé pour les installateurs.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
