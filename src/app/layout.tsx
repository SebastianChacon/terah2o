import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import { UserSync } from "@/components/auth/UserSync";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { WhatsAppFab } from "@/components/fab/WhatsAppFab";
import { RegisterSW } from "@/components/pwa/RegisterSW";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TERAH2O | Inteligencia Operativa",
  description:
    "Plataforma de optimización y control para plantas de tratamiento de agua potable.",
  applicationName: "TeraH2O",
  // iPhone/iPad: "Añadir a pantalla de inicio" abre a pantalla completa.
  appleWebApp: { capable: true, title: "TeraH2O", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Without this, mobile browsers render at ~980px desktop width and zoom out,
// making the entire app unusable on phones. maximumScale is intentionally
// omitted — iOS auto-zoom on inputs is prevented by font-size ≥ 16px (text-base),
// and blocking zoom site-wide violates WCAG 1.4.4.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05051a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body
          className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}
        >
          <ConvexClientProvider>
            <UserSync />
            <SubscriptionGate>{children}</SubscriptionGate>
            <WhatsAppFab />
            <RegisterSW />
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
