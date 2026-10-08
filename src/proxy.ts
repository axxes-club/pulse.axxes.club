import { NextRequest, NextResponse } from 'next/server';
import { safePulseReturn } from '@/lib/auth-return';
export function proxy(request:NextRequest) {
  const headers=new Headers(request.headers);
  headers.set('x-pulse-return-to',safePulseReturn(request.nextUrl.pathname+request.nextUrl.search));
  return NextResponse.next({request:{headers}});
}
export const config={matcher:['/dashboard/:path*']};
