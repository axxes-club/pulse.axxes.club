import {rateLimited} from "@/lib/security/admission";
import {authForHeaders} from "@/lib/auth";
import {toNextJsHandler} from "better-auth/next-js";
export const GET=rateLimited(async request=>toNextJsHandler(authForHeaders(request.headers)).GET(request));
export const POST=rateLimited(async request=>toNextJsHandler(authForHeaders(request.headers)).POST(request));
