import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { useAuth } from "@/lib/auth-context";

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = RAZORPAY_SDK;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Props {
  packId: string;
  label?: string;
  onSuccess?: (credits: number) => void;
}

export function RazorpayPayButton({ packId, label = "Pay with Razorpay", onSuccess }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load Razorpay checkout");
      const res = await createRazorpayOrder({ data: { packId } });
      if ("error" in res) throw new Error(res.error);

      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: res.keyId,
          amount: res.amount,
          currency: res.currency,
          order_id: res.orderId,
          name: "IntelliVerse AI",
          description: `Credit pack — ${res.credits} credits`,
          prefill: { email: user?.email ?? "" },
          theme: { color: "#8B5CF6" },
          handler: async (response: any) => {
            try {
              const v = await verifyRazorpayPayment({
                data: {
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  packId: res.packId,
                },
              });
              if ("error" in v) throw new Error(v.error);
              toast.success(`Payment successful! ${v.credits} credits added.`);
              onSuccess?.(v.credits);
              resolve();
            } catch (e: any) {
              reject(e);
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on("payment.failed", (resp: any) => {
          reject(new Error(resp?.error?.description ?? "Payment failed"));
        });
        rzp.open();
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Payment error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
