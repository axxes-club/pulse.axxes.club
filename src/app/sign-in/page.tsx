import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestAuth, HANDSHAKE_URL } from "@/lib/auth";
import { safePulseReturn } from "@/lib/auth-return";
import { Logo } from "@/components/logo";
import { product } from "@/product.config";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({searchParams}:{searchParams:Promise<{returnTo?:string}>}) {
  const returnTo=safePulseReturn((await searchParams).returnTo);
  const bridge="/api/auth/bridge/start?returnTo="+encodeURIComponent(returnTo);
  const host = (await headers()).get("x-forwarded-host") || (await headers()).get("host");
  if (host === "pulse.axxes.club") redirect("https://pulse.axxes.app"+bridge);
  if (await (await requestAuth()).api.getSession({ headers: await headers() }))
    redirect(returnTo);
  if (host === "pulse.axxes.app") redirect(bridge);
  if (HANDSHAKE_URL) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    redirect(
      `${HANDSHAKE_URL}/sign-in?redirect=${encodeURIComponent(`${origin}${returnTo}`)}`,
    );
  }
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <Logo size="lg" />
        <h1 className="mt-10 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          {product.tagline} Use your AXXES account.
        </p>
        <SignInForm returnTo={returnTo} />
        <p className="mt-6 text-center text-xs text-muted">
          No account?{" "}
          <a
            className="text-accent hover:underline"
            href={"/sign-up?returnTo="+encodeURIComponent(returnTo)}
          >
            Create a Pulse account
          </a>
          {" · "}
          <a
            className="text-accent hover:underline"
            href="https://handshake.axxes.club/forgot-password"
          >
            Forgot password
          </a>
        </p>
      </div>
    </main>
  );
}
