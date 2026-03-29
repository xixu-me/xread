module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: [
    'build/',
    'node_modules/',
    'licensed/',
    '.codex-cache/',
    'coverage/',
  ],
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-extra-semi': 'off',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: ['**/*.js', '**/*.cjs'],
      parserOptions: {
        sourceType: 'script',
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: ['tests/**/*.cjs', 'scripts/**/*.cjs', '*.cjs'],
      env: {
        node: true,
      },
    },
  ],
  rules: {
    'no-empty': 'off',
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'off',
    'no-case-declarations': 'off',
    'no-control-regex': 'off',
    'no-async-promise-executor': 'off',
    'no-constant-condition': 'off',
    'no-extra-boolean-cast': 'off',
    'no-unsafe-optional-chaining': 'off',
    'no-undef': 'off',
    'no-var': 'off',
    'prefer-const': 'off',
    'prefer-rest-params': 'off',
    'require-yield': 'off',
    'import/no-unresolved': 'off',
  },
};
