import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  ssr: false,
  prerender: ["/", "/dashboard", "/ingredients", "/recipes" /* "/profile" */],
  future: {
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
