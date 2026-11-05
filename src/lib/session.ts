// Token de sessão = SHA-256(senha + segredo). Funciona no runtime edge (middleware) e no Node.
export const SESSION_COOKIE = 'haskell_session';

export async function sessionToken(): Promise<string | null> {
  const pass = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!pass || !secret) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${pass}:${secret}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
