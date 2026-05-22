import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  ssr: false,
  prerender: true,
  future: {
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
