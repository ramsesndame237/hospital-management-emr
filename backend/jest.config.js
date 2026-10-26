/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  testEnvironment: 'node',
  testTimeout: 120000,
};
