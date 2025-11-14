import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
  plugins: [resolve(), commonjs()],
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
