// Setup fetch for JSDOM environment using CommonJS
// This runs before test files are loaded

// Polyfill ReadableStream for JSDOM (required by fetch-mock v12)
if (typeof global.ReadableStream === 'undefined') {
  const streams = require('web-streams-polyfill');
  global.ReadableStream = streams.ReadableStream;
  global.WritableStream = streams.WritableStream;
  global.TransformStream = streams.TransformStream;
}

// Provide a basic fetch for initialization
require('isomorphic-fetch');

// Create a placeholder that will be replaced by fetchMock
// Store original for tests that might need it
const originalFetch = global.fetch;

// Create a mutable reference that fetchMock can update
let currentFetch = originalFetch;

// Replace global.fetch with a function that calls whatever currentFetch points to
// This allows fetchMock to update the reference and have all code see the change
global.fetch = function(...args) {
  return currentFetch.apply(this, args);
};

// Make the currentFetch reference available so fetchMock setup can update it
global.__setMockFetch = function(fn) {
  currentFetch = fn;
};

// Also set up globalThis
globalThis.fetch = global.fetch;
globalThis.__setMockFetch = global.__setMockFetch;
