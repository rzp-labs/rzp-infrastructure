const js = require("@eslint/js");
const ts = require("typescript-eslint");
const prettier = require("eslint-plugin-prettier");
const globals = require("globals"); // ← built-in globals list

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
    /* Ignore patterns */
    {
        ignores: ["eslint.config.*", "node_modules/**", "bin/**", "dist/**", "build/**", "*.d.ts"],
    },

    /* Base JS rules */
    js.configs.recommended,

    /* Node globals (process, __dirname, etc.) */
    {
        languageOptions: { globals: globals.node },
    },

    /* Type-checked TS rules */
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: ts.parser,
            parserOptions: {
                project: ["./tsconfig.json"],
                tsconfigRootDir: __dirname,
                // Node globals for TS files too
                globals: globals.node,
            },
        },
        plugins: { "@typescript-eslint": ts.plugin },
        rules: {
            // Extend strict type-checked rules
            ...ts.configs.strictTypeChecked.rules,
            ...ts.configs.stylisticTypeChecked.rules,

            // Promise handling
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/promise-function-async": "error",
            "@typescript-eslint/await-thenable": "error",

            // Type safety
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unsafe-assignment": "error",
            "@typescript-eslint/no-unsafe-call": "error",
            "@typescript-eslint/no-unsafe-member-access": "error",
            "@typescript-eslint/no-unsafe-return": "error",
            "@typescript-eslint/no-unsafe-argument": "error",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/prefer-nullish-coalescing": "error",
            "@typescript-eslint/prefer-optional-chain": "error",

            // Code quality and maintainability
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
            "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
            "@typescript-eslint/consistent-type-exports": "error",
            "@typescript-eslint/no-import-type-side-effects": "error",
            "@typescript-eslint/prefer-readonly": "error",
            "@typescript-eslint/prefer-readonly-parameter-types": "warn",

            // SOLID principles enforcement
            "max-lines": ["error", { max: 150, skipComments: true, skipBlankLines: true }],
            "max-lines-per-function": ["error", { max: 20, skipComments: true, skipBlankLines: true }],
            complexity: ["error", 5],
            "max-depth": ["error", 3],
            "max-params": ["error", 3],

            // Prevent common issues
            "no-console": "error",
            "no-debugger": "error",
            "no-alert": "error",
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            "no-script-url": "error",

            // Import organization
            "sort-imports": ["error", { ignoreDeclarationSort: true }],

            // Naming conventions
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "variableLike",
                    format: ["camelCase", "PascalCase", "UPPER_CASE"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "typeLike",
                    format: ["PascalCase"],
                },
                {
                    selector: "interface",
                    format: ["PascalCase"],
                    prefix: ["I"],
                },
                {
                    selector: "enum",
                    format: ["PascalCase"],
                },
                {
                    selector: "enumMember",
                    format: ["UPPER_CASE"],
                },
            ],
        },
    },

    /* Test files - relaxed rules */
    {
        files: ["**/*.test.ts", "**/*.spec.ts", "**/tests/**"],
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "max-lines-per-function": "off",
            "max-lines": "off",
        },
    },

    /* Prettier formatting warnings */
    {
        plugins: { prettier },
        rules: { "prettier/prettier": "warn" },
    },
];
