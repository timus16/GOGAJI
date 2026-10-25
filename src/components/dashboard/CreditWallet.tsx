"use client";

import { useState } from "react";
import { Button } from "@/components/shared/Button";
import { CreditPack, CREDIT_PACKS } from "@/lib/payments/credit-packs";

export function CreditWallet() {
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (pack: CreditPack) => {
    setSelectedPack(pack);
    setLoading(true);
    try {
      const response = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        const rzp = new (window as any).Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: "Nakshatra Canvas",
          description: `${pack.name} Pack - ${pack.credits} Credits`,
          order_id: data.orderId,
          handler: async (response: any) => {
            await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            window.location.reload();
          },
          prefill: { email: "", contact: "" },
          theme: { color: "#f59e0b" },
        });
        rzp.open();
        setLoading(false);
      };
      document.body.appendChild(script);
    } catch (err) {
      setLoading(false);
      alert(err instanceof Error ? err.message : "Payment failed");
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6 border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-serif font-bold">Credit Wallet</h2>
        <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
          \u{1FA99} {0} Credits
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`relative p-6 rounded-xl border-2 transition-all ${
              pack.popular
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                Most Popular
              </div>
            )}
            <h3 className="font-semibold">{pack.name}</h3>
            <p className="text-3xl font-bold mt-2">{pack.credits}</p>
            <p className="text-slate-500 dark:text-slate-400">Credits</p>
            <div className="mt-4 pt-4 border-t">
              <p className="text-2xl font-bold">\u20B9{pack.price}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">One-time payment</p>
            </div>
            <Button
              className="w-full mt-4"
              variant={pack.popular ? "default" : "outline"}
              onClick={() => handlePurchase(pack)}
              disabled={loading}
            >
              {loading ? "Processing..." : `Buy for \u20B9${pack.price}`}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <h4 className="font-medium mb-2">Manual UPI Payment</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Pay via UPI and submit transaction ID for manual credit approval.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.open("upi://pay?pa=BHARATPE.9G0Q0D1J2B475837@unitype&pn=Nakshatra Canvas&am=99&cu=INR")}>
            Pay via UPI
          </Button>
          <Button variant="ghost" onClick={() => alert("Submit transaction ID in the Transactions page after payment")}>
            Submit TXN ID
          </Button>
        </div>
      </div>
    </div>
  );
}
