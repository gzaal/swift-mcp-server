import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const FIXTURES_DIR = join(__dirname, 'fixtures');

export function setTestCacheDir() {
  process.env.SWIFT_MCP_CACHE_DIR = FIXTURES_DIR;
}

export function resetCacheDir() {
  delete process.env.SWIFT_MCP_CACHE_DIR;
}
