import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/session-provider";
import { InteractiveEffects } from "@/components/ui/interactive-effects";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Beacon — Workspace",
  description: "A focused internal issue tracker for product teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <InteractiveEffects />
          {children}
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}

