import resolve from 'rollup-plugin-local-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';

const globals = {
  'apollo-cache': 'apolloCache.core',
  'apollo-cache-inmemory': 'apolloCache.inmemory',
  'apollo-client': 'apollo.core',
  'apollo-link': 'apolloLink.core',
  'apollo-link-error': 'apolloLink.error',
  'apollo-utilities': 'apollo.utilities',
  'graphql-anywhere': 'graphqlAnywhere',
  'graphql-anywhere/lib/async': 'graphqlAnywhere.async',
};

export default {
  input: 'lib/index.js',
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd',
    exports: 'named',
    name: 'apollo-link-rest',

    globals,
    sourcemap: true,
  },
  external: Object.keys(globals),
  onwarn,
  plugins: [resolve(), sourcemaps()],
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
