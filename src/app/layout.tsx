import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import { UserSync } from "@/components/auth/UserSync";
import { SubscriptionGate } from "@/components/auth/SubscriptionGate";
import { WhatsAppFab } from "@/components/fab/WhatsAppFab";

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
};

// Without this, mobile browsers render at ~980px desktop width and zoom out,
// making the entire app unusable on phones. maximumScale is intentionally
// omitted — iOS auto-zoom on inputs is prevented by font-size ≥ 16px (text-base),
// and blocking zoom site-wide violates WCAG 1.4.4.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
