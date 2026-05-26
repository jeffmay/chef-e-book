import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("ingredients", "routes/ingredients.tsx"),
  route("recipes", "routes/recipes.tsx"),
  route("recipes/new", "routes/recipes.new.tsx"),
  route("recipes/:recipe_id", "routes/recipes.$recipe_id.tsx"),
  route("recipes/:recipe_id/v/:version_id", "routes/recipes.$recipe_id.v.$version_id.tsx"),
  // route("profile", "routes/profile.tsx"),
] satisfies RouteConfig;
