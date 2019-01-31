module.exports = {
  roots: ['<rootDir>/src'],
  globals: {
    'ts-jest': {
      babelConfig: false,
      mapCoverage: true,
      compilerOptions: {
        allowJs: true, // Necessary for jest.js
      },
      diagnostics: {
        ignoreCodes: [
          151001 // Suppress esModuleInterop suggestion that breaks __tests__/restLink.ts
        ]
      }
    },
  },
  transform: {
    '.(ts|tsx)': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|\\.(test|spec))\\.(ts|tsx|js)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  setupFiles: ['./scripts/jest.js'],
};
