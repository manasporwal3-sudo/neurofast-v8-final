// app/layout.tsx — v7 POLISH
// Enhanced metadata, scan line decorative element, smooth Toaster config

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroFast AI — Train Custom Logistics AI in Minutes",
  description:
    "Fine-tune, deploy, and chat with private AI models built on your logistics data. Inventory forecasting, route optimization, demand prediction — built for Indian dark-store and fleet operators.",
  keywords: "AI training, logistics AI, fine-tuning, dark store, fleet management, India, LoRA, LLM",
  openGraph: {
    title: "NeuroFast AI — Sovereign Logistics Intelligence",
    description: "Your own AI trained on your data. SKU forecasting, route optimization, demand prediction.",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuroFast AI Trainer",
    description: "Fine-tune AI models for logistics in under an hour.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          {/* Font preconnect for fastest load */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
            rel="stylesheet"
          />
          {/* Prevent layout shift */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </head>
        <body className="font-body bg-void-black text-foreground antialiased">
          {/* Subtle scan line — visual polish, pointer-events: none */}
          <div className="scan-line" aria-hidden="true" />

          {children}

          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#16162c",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e2e8f0",
                fontFamily: "\'Rajdhani\', sans-serif",
                fontSize: "14px",
                borderRadius: "12px",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
