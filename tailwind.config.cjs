/** @type {import('tailwindcss').Config} */
module.exports = {
  // Kelas Tailwind ada di template HTML & ekspresi Alpine di dalam file-file ini.
  // src/graphql/graphiqlGate.ts juga memuat markup ber-Tailwind (halaman gerbang GraphiQL).
  content: ['./src/frontend/**/*.ts', './src/graphql/graphiqlGate.ts'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};
