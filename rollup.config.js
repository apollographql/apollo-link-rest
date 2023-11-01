import resolve from 'rollup-plugin-local-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';

const globals = {
  '@apollo/client/core': 'apolloClient.core',
  '@apollo/client/utilities': 'apolloClient.utilities',
  '@apollo/link-error': 'apolloLink.error',
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
