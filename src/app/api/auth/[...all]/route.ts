import { authForHeaders } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export async function GET(request: Request) {
  return toNextJsHandler(authForHeaders(request.headers)).GET(request);
}
export async function POST(request: Request) {
  return toNextJsHandler(authForHeaders(request.headers)).POST(request);
}
