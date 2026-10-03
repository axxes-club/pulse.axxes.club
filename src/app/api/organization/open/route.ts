import { NextResponse } from "next/server"
import { publicOrigin } from "@/lib/public-origin"
import { switchOrganization } from "@/lib/actions/org"

/** A suite launch preference is revalidated by the existing server switch action. */
export async function GET(request: Request) {
  const tenant = new URL(request.url).searchParams.get("tenant")
  if (!tenant || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant)) {
    return NextResponse.json({ error: "Invalid organization." }, { status: 400 })
  }
  const result = await switchOrganization(tenant)
  if(result.error?.includes("sign in")){
    const origin=publicOrigin(request);
    if(new URL(request.url).searchParams.get("embed")==="1")return NextResponse.redirect(new URL("/embed/overview",origin));
    if(new URL(origin).hostname==="pulse.axxes.app")return NextResponse.redirect(new URL("/api/auth/bridge/start?tenant="+tenant,origin));
    const handshake=process.env.HANDSHAKE_URL?.replace(/\/$/,"");
    if(handshake)return NextResponse.redirect(handshake+"/sign-in?redirect="+encodeURIComponent(origin+"/api/organization/open?tenant="+tenant));
    return NextResponse.redirect(new URL("/sign-in",origin));
  }
  if(result.error)return NextResponse.json({error:result.error},{status:403})
  const target=new URL(new URL(request.url).searchParams.get("embed") === "1" ? "/embed/overview" : "/dashboard",publicOrigin(request));
  const site=new URL(request.url).searchParams.get("site");if(site&&/^app_[a-z0-9]{32}$/.test(site))target.searchParams.set("site",site);
  return NextResponse.redirect(target)
}
