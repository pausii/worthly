import { createYoga, createSchema, type Plugin } from 'graphql-yoga';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { authPlugin } from './authPlugin';
import { buildContext } from './context';

// Tulis Set-Cookie (login/logout) dari cookieJar yang dibagikan via serverContext.
function cookieResponsePlugin(): Plugin {
  return {
    onResponse({ serverContext, response }) {
      const jar = (serverContext as { cookieJar?: string[] })?.cookieJar;
      if (jar) for (const cookie of jar) response.headers.append('Set-Cookie', cookie);
    },
  };
}

export const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  // GraphiQL ("yoga-server") di-gate login + password di lapisan Hono (lihat index.ts).
  graphiql: {
    title: 'Worthly GraphQL Console',
    defaultQuery: [
      '# Tekan ▶ untuk menjalankan. Query baca otomatis pakai session login.',
      '# Untuk MUTATION, tambahkan header berikut di tab "Headers":',
      '#   { "X-CSRF-Token": "<ambil dari query Me { me } -> csrf>" }',
      '',
      'query Me { me }',
    ].join('\n'),
  },
  landingPage: false,
  // Jangan mask error agar pesan validasi tampil apa adanya (mirror REST fail(c, msg)).
  maskedErrors: false,
  context: (initial) => buildContext(initial as never),
  plugins: [authPlugin(), cookieResponsePlugin()],
});
