import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { absoluteSiteUrl, getSiteUrl } from "@/lib/site-url";
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
  metadataBase: getSiteUrl(),
  title: "SmartBrew | Tecnología, gadgets y café",
  description:
    "Descubrí productos tech, gadgets y accesorios de café seleccionados por SmartBrew para mejorar tu día.",
  openGraph: {
    title: "SmartBrew | Coffee & Technology",
    description:
      "Tecnología, gadgets y accesorios de café seleccionados para tu rutina.",
    type: "website",
    url: "/",
    siteName: "SmartBrew",
    locale: "es_AR",
    images: [{ url: "/smartbrew-logo.png", alt: "SmartBrew" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SmartBrew | Coffee & Technology",
    description: "Tecnología, gadgets y accesorios de café seleccionados para tu rutina.",
    images: ["/smartbrew-logo.png"],
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SmartBrew',
              url: absoluteSiteUrl('/'),
              logo: absoluteSiteUrl('/smartbrew-logo.png'),
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
