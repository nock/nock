import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import mocha from "eslint-plugin-mocha";
import node from "eslint-plugin-n";

export default defineConfig([
  {
    files: ["**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    ignores: ['node_modules', 'coverage'],
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
    files: ["tests/**/*.js"],
    rules: {
      "mocha/no-pending-tests": "off", // until we will fix all tests
      "mocha/no-mocha-arrows": "off",
      "mocha/no-identical-title": "off",
      "mocha/no-top-level-hooks": "off",
    },
  },
  prettier
]);
