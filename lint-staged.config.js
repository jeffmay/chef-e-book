export default {
  "*": ["prettier --write .", () => "graphify update ."],
  "*.{ts,tsx,css,js,mjs,json,jsonc}": ["eslint --cache --fix"],
  "**/*.ts?(x)": [() => "npm run typecheck"],
};
