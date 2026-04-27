// components/billing/BuyCreditsButton.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import Script from "next/script";

interface Props {
  credits: number;
  priceINR: number;
  label: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

export default function BuyCreditsButton({ credits, priceINR, label }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      // Create Razorpay order
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits, priceINR }),
      });

      const data = await res.json() as { orderId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create order");

      // Open Razorpay checkout
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: priceINR * 100, // Razorpay expects paise
        currency: "INR",
        name: "NeuroFast AI Trainer",
        description: `${credits} Credits — ${label} Pack`,
        order_id: data.orderId!,
        handler: async (response) => {
          // Verify payment
          const verifyRes = await fetch("/api/billing/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              credits,
              priceINR,
            }),
          });

          const verifyData = await verifyRes.json() as { success?: boolean; error?: string };
          if (verifyData.success) {
            toast.success(`✅ ${credits} credits added to your account!`);
            window.location.reload();
          } else {
            toast.error("Payment verification failed. Contact support.");
          }
        },
        theme: { color: "#00f0ff" },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info("Payment cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="w-full btn-neon py-2 rounded text-sm font-display disabled:opacity-40"
      >
        {loading ? "PROCESSING..." : "BUY NOW"}
      </button>
    </>
  );
}
