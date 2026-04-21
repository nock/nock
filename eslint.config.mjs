import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import mocha from "eslint-plugin-mocha";
import node from "eslint-plugin-n";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  {
    files: ["**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node, sourceType: 'module' },
  },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.base],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
      parser: tseslint.parser,
    },
  },
  {
    plugins: { n: node },
    extends: [node.configs["flat/recommended"]],
    rules: {
      'n/no-unsupported-features/node-builtins': ['error', { allowExperimental: true }],
      'n/prefer-node-protocol': 'error',
    }
  },
  {
    plugins: { mocha },
    extends: [mocha.configs.recommended],
    files: ["tests/**/*.{js,ts}"],
    rules: {
      "mocha/no-pending-tests": "off",
      "mocha/no-mocha-arrows": "off",
      "mocha/no-identical-title": "off",
      "mocha/no-top-level-hooks": "off",
      "mocha/no-global-tests": "off",
      "mocha/max-top-level-suites": "off",
      "mocha/no-exports": "off",
    },
  },
  prettier
]);
