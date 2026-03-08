import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "data");

mkdirSync(dataDir, { recursive: true });

// Point DB to a test-specific file
process.env.GITHUBBRO_DB = join(dataDir, "test.db");
