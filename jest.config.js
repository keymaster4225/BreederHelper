module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.screen.test.tsx', '**/*.integration.test.tsx'],
  testPathIgnorePatterns: ['<rootDir>/.worktrees/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.screen.test.tsx',
    '!src/**/*.integration.test.tsx',
    '!src/types/**',
  ],
  coverageDirectory: '<rootDir>/coverage/jest',
  coverageReporters: ['text', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
