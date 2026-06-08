export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: [
    '**/tests/integration/**/*.test.js',
  ],
  setupFiles: ['./tests/pre-setup.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 60000,
  verbose: true,
  forceExit: true,
};
