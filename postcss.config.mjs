import tailwind from '@tailwindcss/postcss';

// Next.js requires PostCSS plugins to be specified as strings. Vitest's
// PostCSS loader (used in component tests) needs the actual function.  Detect
// when we're running under the test harness and switch shapes accordingly.
const isVitest = typeof process.env.VITEST !== 'undefined' || process.env.NODE_ENV === 'test';

const config = {
  plugins: [
    isVitest ? tailwind : '@tailwindcss/postcss'
  ],
};

export default config;
