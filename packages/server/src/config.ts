import arkenv from "arkenv";
import { type } from "arktype";

export const StorageEngine = type.enumerated("local-memory", "local-file", "netlify-blobs");
export type StorageEngine = typeof StorageEngine.infer;

export interface ServerConfig {
  readonly PORT: number;
  readonly STORAGE_ENGINE: StorageEngine;
  readonly NETLIFY_PROJECT_ID: string;
}

const rawEnv = arkenv(
  {
    PORT: "string.numeric",
    STORAGE_ENGINE: "'local-memory' | 'local-file' | 'netlify-blobs'",
    NETLIFY_PROJECT_ID: "string",
  },
  {
    env: {
      PORT: process.env["PORT"] ?? "3001",
      STORAGE_ENGINE: process.env["STORAGE_ENGINE"] ?? "local-memory",
      NETLIFY_PROJECT_ID: process.env["NETLIFY_PROJECT_ID"] ?? "",
    },
  },
);

const port = Number(rawEnv["PORT"]);

export const serverConfig: ServerConfig = {
  PORT: Number.isFinite(port) ? port : 3001,
  STORAGE_ENGINE: rawEnv["STORAGE_ENGINE"] as StorageEngine,
  NETLIFY_PROJECT_ID: rawEnv["NETLIFY_PROJECT_ID"],
};
