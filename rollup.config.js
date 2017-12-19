export default {
  entry: 'lib/index.js',
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd',
  },
  name: 'apollo-link-rest',
  exports: 'named',
  sourceMap: true,
  onwarn,
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
