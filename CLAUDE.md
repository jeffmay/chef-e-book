# Project: Recipe Book

## Project Description
A local-first single-page web app (built on Yjs) that makes it easy to create and modify recipes, ingredients, and containers.

## Code Conventions
- Prettier for formatting
- ESLint for linting
- Functional components with hooks for React
- 2-space indentation
- TitleCase for component, classes, and enum names and snake_case for everything else

## Common Development Tasks

```
npm run typecheck     # Typecheck all files
npm test              # Run all tests
npm run lint          # Run the linter on all files
```

The app is running at http://localhost:5173, and you can use the Playwright MCP to access it.

## Important Notes
- ALWAYS use relative paths over absolute paths to avoid needing to prompt me for access.
- MUST ALWAYS run `npm run typecheck`, then `npm test`, and then `npm run lint` for all files before commiting code changes.
- MUST ALWAYS commit all completed work with a comprehensive git commit message using [gitmoji](https://gitmoji.dev/) where applicable.
- MUST ALWAYS keep PROJECT_SUMMARY.md up-to-date with any changes to completed features, testing architecture, file structure, and future development goals.
- MUST ALWAYS write unit tests for all changes.
- MUST NEVER skip unit tests using early returns. Instead, ALWAYS provide a test fixture with values that meet the test pre-conditions when initializing the game state or throw something on unexpected state to satisfy the type checker.
- MUST ALWAYS write component tests for all view changes.
- MUST NEVER use the `as` keyword to cast a type without validating every field in the type.
- MUST NEVER use the `in` keyword to test for the existance of a property on a union type. Instead, use the proper type union discriminator field to narrow the type to the desired type or interface.
- MUST NEVER use the `any` type. Instead, try your best to define a strict generic type. If you are adding type information to something that does not allow passing the type information along (such as deserialization or APIs that return untyped data), then use a specific function to validate and cast the object as the expected / provided type. Or, as a last resort, use the `unknown` type instead.
- MUST ALWAYS use double quotes ("") for constant strings, unless the string itself contains double quotes, in which case, you should use single quotes ('"'), unless the string contains both double and single quotes, in which case use backticks (`"''"`).
- MUST ALWAYS use responsive design to ensure that the elements never require horizontal scrolling, while maximizing use of horizontal space for mobile device, tablet, laptop, and wide screens.
- MUST ALWAYS use CSS over JavaScript for styling elements.
- MUST ALWAYS use `vw` units unless the element is a horizontal line or when creating a font-size that is relative to a sibling or parent element, in which case, `em` is fine.
