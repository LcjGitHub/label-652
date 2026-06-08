export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: [
    '**/tests/unit/**/*.test.js',
  ],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  setupFiles: ['./tests/unit/mock-db.cjs'],
};
