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
  title: "SmartBrew | Tecnología, gadgets y café",
  description:
    "Descubrí productos tech, gadgets y accesorios de café seleccionados por SmartBrew para mejorar tu día.",
  openGraph: {
    title: "SmartBrew | Coffee & Technology",
    description:
      "Tecnología, gadgets y accesorios de café seleccionados para tu rutina.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
