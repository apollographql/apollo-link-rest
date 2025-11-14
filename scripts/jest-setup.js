// Polyfill fetch for JSDOM environment first
import 'isomorphic-fetch';

// Import and set up fetch-mock globally for all tests
import fetchMock from '@fetch-mock/jest';

// Patch global fetch for all tests
fetchMock.mockGlobal();
