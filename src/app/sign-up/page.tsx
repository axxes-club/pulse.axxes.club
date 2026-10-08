import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safePulseReturn } from "@/lib/auth-return";
import { requestAuth, HANDSHAKE_URL } from "@/lib/auth";

export default async function SignUpPage({searchParams}:{searchParams:Promise<{returnTo?:string}>}) {
  const returnTo=safePulseReturn((await searchParams).returnTo);
  const bridge="/api/auth/bridge/start?mode=signup&returnTo="+encodeURIComponent(returnTo);
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host === "pulse.axxes.club") redirect("https://pulse.axxes.app"+bridge);
  if (await (await requestAuth()).api.getSession({ headers: h })) redirect(returnTo);
  if (host === "pulse.axxes.app") redirect(bridge);
  if (HANDSHAKE_URL) redirect(`${HANDSHAKE_URL}/sign-up?redirect=${encodeURIComponent("https://pulse.axxes.club"+returnTo)}`);
  redirect("/sign-in");
}
