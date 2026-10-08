import { NextResponse, type NextRequest } from "next/server";
import { getCheckout, getSubscription } from "@/lib/axxes-payments";
import { applySubscription } from "@/lib/billing/store";
import { pulseOrigin } from "@/lib/billing/routes";

// Buyers return here from payments.axxes.app. The checkout ID is only a pointer: the plan is
// written from state read back from Payments with Pulse's own key, never from this URL.
export async function GET(request: NextRequest) {
  const destination = new URL("/dashboard/billing", pulseOrigin(request));
  try {
    const checkout = await getCheckout(request.nextUrl.searchParams.get("axxes_checkout") ?? "");
    const done = checkout.state === "paid" || checkout.state === "no_payment_due";
    if (checkout.product === "pulse" && checkout.subscription && done) {
      await applySubscription(await getSubscription(checkout.subscription), "payments-return");
      destination.searchParams.set("checkout", "success");
    } else {
      destination.searchParams.set("checkout", checkout.state === "processing" ? "processing" : "incomplete");
    }
  } catch {
    destination.searchParams.set("checkout", "incomplete");
  }
  return NextResponse.redirect(destination, 303);
}
