#!/bin/bash -e

# When we publish to npm, the published files are available in the root
# directory, which allows for a clean include or require of sub-modules.
#
#    var language = require('react-apollo/server');
#
if [ "${npm_command}" != "run-script" ]; then
  echo "To ensure that your npm cli has the right credentials, you must run this through 'npm run deploy' instead of yarn." >&2
  exit 1;
fi

# Clear the built output
rm -rf ./lib

# Compile new files
npm run build

# Make sure the ./npm directory is empty
rm -rf ./npm
mkdir ./npm

# Copy all files from ./lib to /npm
cd ./lib && cp -r ./ ../npm/
# Copy also the umd bundle with the source map file
cp bundle.umd.js ../npm/ && cp bundle.umd.js.map ../npm/

# Back to the root directory
cd ../

# Ensure a vanilla package.json before deploying so other tools do not interpret
# The built output as requiring any further transformation.
node -e "var package = require('./package.json'); \
  delete package.babel; \
  delete package[\"lint-staged\"]; \
  delete package.jest; \
  delete package.bundlesize; \
  delete package.scripts; \
  delete package.options; \
  package.main = 'bundle.umd.js'; \
  package.browser = 'bundle.umd.js'; \
  package.module = 'index.js'; \
  package['jsnext:main'] = 'index.js'; \
  package['react-native'] = 'index.js'; \
  package.typings = 'index.d.ts'; \
  var origVersion = 'local';
  var fs = require('fs'); \
  fs.writeFileSync('./npm/package.json', JSON.stringify(package, null, 2)); \
  "

# Copy few more files to ./npm
cp README.md npm/
cp LICENSE npm/
cp schema.graphql npm/

echo "deploying to npm…"
(cd npm && npm publish) || (>&2 echo "If this failed with ENEEDAUTH, remember that 'yarn deploy' won't work because yarn hot-patches npm's registry to yarn pkg.com")
