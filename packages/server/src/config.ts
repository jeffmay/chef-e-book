import { DefCompanion, EnumCompanion, unionOf } from "@recipe-book/shared";
import arkenv from "arkenv";

export const StorageEngine = EnumCompanion("StorageEngine", [
  "local-memory",
  "local-file",
  "netlify-blobs",
]);
export type StorageEngine = typeof StorageEngine.type.infer;

export const ServerConfig = DefCompanion("ServerConfig", {
  PORT: "0 <= number.integer <= 65535 = 3001",
  STORAGE_ENGINE: `${unionOf(StorageEngine.values)} = 'local-file'`,
  "NETLIFY_PROJECT_ID?": "string",
});
export type ServerConfig = typeof ServerConfig.type.infer;

export default arkenv(ServerConfig.def, { env: process.env });
