import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

class McpTestClient {
  private server: ChildProcess | null = null;
  private messageBuffer = '';
  private responseResolvers = new Map<number, (response: JsonRpcResponse) => void>();
  private nextId = 1;

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = spawn('node', [join(PROJECT_ROOT, 'dist', 'server.js')], {
        cwd: PROJECT_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, SWIFT_MCP_CACHE_DIR: join(__dirname, '..', 'fixtures') },
      });

      this.server.stdout?.setEncoding('utf8');
      this.server.stdout?.on('data', (data: string) => {
        this.handleData(data);
      });

      this.server.stderr?.setEncoding('utf8');
      this.server.stderr?.on('data', (data: string) => {
        // Log stderr for debugging but don't fail
        if (process.env.DEBUG) {
          console.error('Server stderr:', data);
        }
      });

      this.server.on('error', reject);

      // Give server time to start
      setTimeout(resolve, 500);
    });
  }

  private handleData(data: string): void {
    this.messageBuffer += data;
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as JsonRpcResponse;
          const resolver = this.responseResolvers.get(response.id);
          if (resolver) {
            resolver(response);
            this.responseResolvers.delete(response.id);
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
  }

  async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      if (!this.server?.stdin) {
        reject(new Error('Server not started'));
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.responseResolvers.set(id, resolve);

      // Set timeout for response
      const timeout = setTimeout(() => {
        this.responseResolvers.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 10000);

      this.server.stdin.write(JSON.stringify(request) + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.responseResolvers.delete(id);
          reject(err);
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }
}

describe('MCP Protocol Integration', () => {
  let client: McpTestClient;

  beforeAll(async () => {
    client = new McpTestClient();
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  describe('initialize', () => {
    it('should complete initialization handshake', async () => {
      const response = await client.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as Record<string, unknown>;
      expect(result.protocolVersion).toBeDefined();
      expect(result.serverInfo).toBeDefined();

      const serverInfo = result.serverInfo as Record<string, unknown>;
      expect(serverInfo.name).toBe('swift-mcp-server');
    });
  });

  describe('tools/list', () => {
    it('should return list of available tools', async () => {
      const response = await client.send('tools/list', {});

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { tools: Array<{ name: string; description: string }> };
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Check for expected tools
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('swift_docs_search');
      expect(toolNames).toContain('swift_evolution_lookup');
      expect(toolNames).toContain('swift_guidelines_check');
      expect(toolNames).toContain('apple_docs_search');
      expect(toolNames).toContain('search_hybrid');
    });

    it('should include tool descriptions', async () => {
      const response = await client.send('tools/list', {});
      const result = response.result as { tools: Array<{ name: string; description: string }> };

      const docsTool = result.tools.find(t => t.name === 'swift_docs_search');
      expect(docsTool).toBeDefined();
      expect(docsTool?.description).toBeTruthy();
    });
  });

  describe('tools/call', () => {
    it('should execute swift_guidelines_check', async () => {
      const response = await client.send('tools/call', {
        name: 'swift_guidelines_check',
        arguments: { code: 'struct myBadType {}' },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.issues).toBeDefined();
      expect(parsed.issues.length).toBeGreaterThan(0);
    });

    it('should execute swift_docs_search', async () => {
      const response = await client.send('tools/call', {
        name: 'swift_docs_search',
        arguments: { query: 'protocol', limit: 3 },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toBeDefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should execute cocoa_patterns_search', async () => {
      const response = await client.send('tools/call', {
        name: 'cocoa_patterns_search',
        arguments: { queryOrTag: 'keyboard', limit: 3 },
      });

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should return error for unknown tool', async () => {
      const response = await client.send('tools/call', {
        name: 'nonexistent_tool',
        arguments: {},
      });

      expect(response.error).toBeDefined();
    });

    it('should validate tool arguments', async () => {
      const response = await client.send('tools/call', {
        name: 'swift_guidelines_check',
        arguments: {}, // Missing required 'code' argument
      });

      expect(response.error).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return error for unknown method', async () => {
      const response = await client.send('unknown/method', {});
      expect(response.error).toBeDefined();
    });
  });
});
