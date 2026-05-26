import type { StorageEngine } from "../config.js";
import { serverConfig } from "../config.js";
import type { DocumentStore } from "./types.js";
import { LocalFileStore } from "./localFile.js";
import { LocalMemoryStore } from "./localMemory.js";
import { NetlifyBlobStore } from "./netlifyBlobs.js";

export { DocumentStore };

export function createDocumentStore(engine?: StorageEngine): DocumentStore {
  const storageEngine = engine ?? serverConfig.STORAGE_ENGINE;

  switch (storageEngine) {
    case "local-file":
      return new LocalFileStore("./data");
    case "netlify-blobs": {
      const projectId = serverConfig.NETLIFY_PROJECT_ID;
      if (!projectId) {
        throw new Error("NETLIFY_PROJECT_ID is required when STORAGE_ENGINE=netlify-blobs");
      }
      return new NetlifyBlobStore(projectId);
    }
    case "local-memory":
    default:
      return new LocalMemoryStore();
  }
}
