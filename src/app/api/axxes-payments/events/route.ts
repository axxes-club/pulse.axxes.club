import { getSubscription, paymentsMode, verifyPaymentsEvent } from "@/lib/axxes-payments";
import { applySubscription } from "@/lib/billing/store";

// Signed subscription events from payments.axxes.app. A non-2xx answer makes Payments retry.
// The event only says which subscription changed; its state is re-read from Payments, so a
// replayed or out-of-order event can never roll a plan back.
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 65536) return Response.json({ error: "Too large" }, { status: 413 });
  const body = await request.text();
  if (body.length > 65536) return Response.json({ error: "Too large" }, { status: 413 });
  const event = verifyPaymentsEvent(body, request.headers.get("axxes-payments-signature"));
  if (!event) return Response.json({ error: "Invalid signature" }, { status: 400 });
  if (event.product !== "pulse" || event.mode !== paymentsMode()) return Response.json({ ignored: true });
  const id = event.subscription?.id ?? event.checkout?.subscription;
  if (!id) return Response.json({ ignored: true });
  try {
    await applySubscription(await getSubscription(id), `payments-event:${event.id}`);
    return Response.json({ received: true });
  } catch (e) {
    console.error("pulse_payments_event_failed", e instanceof Error ? e.name : "unknown");
    return Response.json({ error: "Retry later" }, { status: 503 });
  }
}
