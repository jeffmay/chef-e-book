import arkenv from "arkenv";
import { type } from "arktype";
import { Companion } from "@recipe-book/shared/src/types/companion";
import { EnumCompanion } from "@recipe-book/shared/src/types/enums";

export const StorageEngine = EnumCompanion("StorageEngine", [
  "local-memory",
  "local-file",
  "netlify-blobs",
]);
export type StorageEngine = typeof StorageEngine.type.infer;

export const ServerConfigDef = {
  PORT: "0 <= number.integer <= 65535 = 3001",
  STORAGE_ENGINE: StorageEngine.type,
  "NETLIFY_PROJECT_ID?": "string",
} as const;

export const ServerConfig = Companion("ServerConfig", type(ServerConfigDef));
export type ServerConfig = typeof ServerConfig.type.infer;

export const serverConfig = arkenv(ServerConfigDef, { env: process.env });
