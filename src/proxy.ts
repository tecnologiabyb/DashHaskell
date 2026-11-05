import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionToken } from '@/lib/session';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();

  const expected = await sessionToken();
  const ok = !!expected && req.cookies.get(SESSION_COOKIE)?.value === expected;
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api')) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|webp|ico)$).*)'],
};
