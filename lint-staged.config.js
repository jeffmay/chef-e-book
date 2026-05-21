export default {
  "**/*.ts?(x)": () => "npm run typecheck",
  "*.{ts,tsx,css,js,mjs,json,jsonc}": ["eslint --cache --fix", "prettier --write"],
};
