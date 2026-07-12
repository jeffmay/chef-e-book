/// <reference types="vite/client" />

declare module "*.css";

interface ImportMetaEnv {
  /** Default per-ingredient prep time in seconds (defaults to 120 when unset). */
  readonly VITE_DEFAULT_SECONDS_PER_INGREDIENT?: string;
}
