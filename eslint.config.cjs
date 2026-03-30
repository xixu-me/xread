const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const sharedRules = {
    'no-empty': 'off',
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'off',
    'no-case-declarations': 'off',
    'no-control-regex': 'off',
    'no-async-promise-executor': 'off',
    'no-constant-condition': 'off',
    'no-extra-boolean-cast': 'off',
    'no-extra-semi': 'off',
    'no-unsafe-optional-chaining': 'off',
    'no-undef': 'off',
    'no-var': 'off',
    'prefer-const': 'off',
    'prefer-rest-params': 'off',
    'require-yield': 'off',
};

module.exports = [
    {
        ignores: [
            'build/**',
            'node_modules/**',
            'licensed/**',
            '.codex-cache/**',
            'coverage/**',
        ],
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs['flat/recommended'][1].rules,
            ...tsPlugin.configs['flat/recommended'][2].rules,
            ...sharedRules,
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-extra-semi': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/ban-types': 'off',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-wrapper-object-types': 'off',
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
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            ...sharedRules,
            'no-unused-vars': [
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
        files: ['**/*.cjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
        },
        rules: {
            ...sharedRules,
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
];
