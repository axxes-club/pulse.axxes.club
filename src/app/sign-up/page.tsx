import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestAuth, HANDSHAKE_URL } from "@/lib/auth";

export default async function SignUpPage() {
  const h = await headers();
  if (await (await requestAuth()).api.getSession({ headers: h })) redirect("/dashboard");
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host === "pulse.axxes.app") redirect("/api/auth/bridge/start?mode=signup");
  if (host === "pulse.axxes.club") redirect("https://pulse.axxes.app/api/auth/bridge/start?mode=signup");
  if (HANDSHAKE_URL) redirect(`${HANDSHAKE_URL}/sign-up?redirect=${encodeURIComponent("https://pulse.axxes.club/dashboard")}`);
  redirect("/sign-in");
}
