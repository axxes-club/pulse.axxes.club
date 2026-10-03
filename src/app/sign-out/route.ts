import { NextResponse, type NextRequest } from "next/server";
import { authForHeaders, HANDSHAKE_URL } from "@/lib/auth";
import { publicOrigin } from "@/lib/public-origin";
export async function GET(req: NextRequest) {
 const result=await authForHeaders(req.headers).api.signOut({headers:req.headers,asResponse:true}).catch(()=>null);
 const back=new URL("/",publicOrigin(req)).href;
 const res=NextResponse.redirect(HANDSHAKE_URL?`${HANDSHAKE_URL}/sign-out?redirect=${encodeURIComponent(back)}`:new URL("/sign-in",publicOrigin(req)));
 result?.headers.getSetCookie().forEach(cookie=>res.headers.append("set-cookie",cookie));return res;
}
