import { type Config } from "prettier";

const config: Config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 100,
  arrowParens: "always",
  overrides: [
    {
      files: ["*.json"],
      excludeFiles: ["graphify-out/**"],
    },
  ],
};

export default config;
