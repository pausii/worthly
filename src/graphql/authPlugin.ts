import { getOperationAST, GraphQLError, Kind } from 'graphql';
import type { Plugin } from 'graphql-yoga';
import type { GraphQLContext } from './context';

// Operasi publik (tanpa session) — mirror /api/auth/{status,login,setup} di routes/auth.ts.
const PUBLIC_OPS = new Set(['authStatus', 'login', 'setup']);
// Mutation yang TIDAK butuh CSRF — login/setup publik, logout hanya requireAuth (tanpa requireCsrf).
const NO_CSRF_OPS = new Set(['login', 'setup', 'logout']);

/**
 * Plugin gerbang auth/CSRF, mereplikasi requireAuth + requireCsrf lama:
 *  - query/mutation apa pun (selain PUBLIC_OPS) wajib session → else 401.
 *  - mutation (selain NO_CSRF_OPS) wajib header X-CSRF-Token == session.csrf → else 403.
 *    (query = baca, dulu lewat GET tanpa CSRF; mutation = tulis, dulu lewat POST dgn CSRF.)
 */
export function authPlugin(): Plugin<GraphQLContext> {
  return {
    onExecute({ args }) {
      const op = getOperationAST(args.document, args.operationName ?? undefined);
      if (!op) return; // operasi tak jelas → biarkan mekanisme validasi normal menangani.
      const ctx = args.contextValue as GraphQLContext;

      const rootFields: string[] = [];
      for (const sel of op.selectionSet.selections) {
        if (sel.kind === Kind.FIELD) rootFields.push(sel.name.value);
      }

      const needsAuth = rootFields.some((f) => !PUBLIC_OPS.has(f));
      if (needsAuth && !ctx.session) {
        throw new GraphQLError('unauthorized', {
          extensions: { code: 'UNAUTHORIZED', http: { status: 401 } },
        });
      }

      if (op.operation === 'mutation') {
        const needsCsrf = rootFields.some((f) => !NO_CSRF_OPS.has(f));
        if (needsCsrf && (!ctx.session || !ctx.csrfHeader || ctx.csrfHeader !== ctx.session.csrf)) {
          throw new GraphQLError('csrf_failed', { extensions: { http: { status: 403 } } });
        }
      }
    },
  };
}
