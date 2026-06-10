import type { Env, SessionData } from '../types';
import { getSession } from '../lib/session';

// Konteks GraphQL per-request. Menggantikan peran middleware Hono (requireAuth/requireCsrf)
// + binding env. cookieJar dibagikan dengan onResponse plugin (lihat yoga.ts) untuk menulis
// Set-Cookie pada login/logout.
export interface GraphQLContext {
  env: Env;
  executionCtx: ExecutionContext;
  request: Request;
  sid?: string;
  session: SessionData | null;
  csrfHeader: string | null;
  ip: string;
  ua?: string;
  cookieJar: string[];
}

// Objek server-context yang kita oper ke yoga.fetch(request, serverContext).
export interface ServerContext {
  env: Env;
  executionCtx: ExecutionContext;
  cookieJar: string[];
}

// Cocokkan persis dengan lib/session.ts.
const SESSION_COOKIE = '__Host-sid';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}

/** String Set-Cookie session (mirror setSessionCookie di lib/session.ts). */
export function buildSessionCookie(sid: string): string {
  return `${SESSION_COOKIE}=${sid}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

/** String Set-Cookie penghapus session (mirror clearSessionCookie). */
export function clearSessionCookieStr(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

// Dibangun Yoga dari serverContext + request (lihat catatan di yoga.ts).
type InitialContext = ServerContext & { request: Request };

/** Context factory Yoga: resolusi session dari cookie + kumpulkan header relevan. */
export async function buildContext(initial: InitialContext): Promise<GraphQLContext> {
  const { env, request } = initial;
  const sid = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  const session = sid ? await getSession(env, sid) : null;
  return {
    ...initial,
    sid,
    session,
    csrfHeader: request.headers.get('X-CSRF-Token'),
    ip: request.headers.get('CF-Connecting-IP') ?? 'unknown',
    ua: request.headers.get('User-Agent') ?? undefined,
  };
}
