global.fetch = require('jest-fetch-mock');

// Allow routes to be stacked (fetch-mock @ >= 7.0) -- is buggy in beta.6
require('fetch-mock').config.overwriteRoutes = false;
