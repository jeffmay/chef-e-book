import type { ConfigObject, Plugin } from "@eslint/core";
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importX from "eslint-plugin-import-x";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

const config: ConfigObject[] = [
  js.configs.recommended,
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin as unknown as Plugin,
      "import-x": importX as unknown as Plugin,
      "react-hooks": reactHooksPlugin as unknown as Plugin,
      react: reactPlugin as unknown as Plugin,
    },
    settings: {
      "import-x/resolver": {
        typescript: true,
        node: true,
      },
    },
    rules: {
      ...tsPlugin.configs.recommended!.rules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "import-x/extensions": ["error", "always", { ignorePackages: true }],
      "import-x/no-unresolved": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      quotes: ["error", "double", { avoidEscape: true }],
      // TypeScript allows `const Foo = [...] as const; type Foo = ...` (merged declaration).
      // The base no-redeclare rule doesn't understand this — disable it in TS files.
      "no-redeclare": "off",
    },
  },
  {
    files: ["packages/*/src/**/*.tsx"],
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    ignores: ["**/build/**", "**/dist/**", "**/node_modules/**"],
  },
];

export default config;
