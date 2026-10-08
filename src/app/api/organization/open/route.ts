import { NextResponse } from "next/server"
import { switchOrganization } from "@/lib/actions/org"
import { safePulseReturn,pulseEmbedPath } from "@/lib/auth-return";
import { publicOrigin } from "@/lib/public-origin"

/** A suite launch preference is revalidated by the existing server switch action. */
export async function GET(request: Request) {
  const tenant = new URL(request.url).searchParams.get("tenant")
  if (!tenant || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant)) {
    return NextResponse.json({ error: "Invalid organization." }, { status: 400 })
  }
  const search=new URL(request.url).searchParams;
  const destination=new URL(safePulseReturn(search.get("returnTo")),"https://pulse.axxes.app");
  const site=search.get("site");
  if(site&&/^app_[a-z0-9]{32}$/.test(site))destination.searchParams.set("site",site);
  const returnTo=destination.pathname+destination.search;
  const result = await switchOrganization(tenant)
  if(result.error?.includes("sign in")){
    const origin=publicOrigin(request);
    if(search.get("embed")==="1")return NextResponse.redirect(new URL(pulseEmbedPath(returnTo),origin));
    if(new URL(origin).hostname==="pulse.axxes.app")return NextResponse.redirect(new URL("/api/auth/bridge/start?tenant="+tenant+"&returnTo="+encodeURIComponent(returnTo),origin));
    const handshake=process.env.HANDSHAKE_URL?.replace(/\/$/,"");
    if(handshake)return NextResponse.redirect(handshake+"/sign-in?redirect="+encodeURIComponent(origin+"/api/organization/open?tenant="+tenant+"&returnTo="+encodeURIComponent(returnTo)));
    return NextResponse.redirect(new URL("/sign-in?returnTo="+encodeURIComponent(returnTo),origin));
  }
  if(result.error)return NextResponse.json({error:result.error},{status:403})
  const target=new URL(new URL(request.url).searchParams.get("embed") === "1" ? pulseEmbedPath(returnTo) : returnTo,publicOrigin(request));
  if(site&&/^app_[a-z0-9]{32}$/.test(site))target.searchParams.set("site",site);
  return NextResponse.redirect(target)
}
