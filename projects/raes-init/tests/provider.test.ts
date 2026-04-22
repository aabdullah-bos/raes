import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadProvider, ProviderError } from '../src/provider.ts';
import { main } from '../src/cli.ts';

function withEnv(overrides: Record<string, string | undefined>, fn: () => unknown) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

test('loadProvider throws ProviderError when RAES_PROVIDER is unset', () => {
  withEnv({ RAES_PROVIDER: undefined }, () => {
    assert.throws(
      () => loadProvider(),
      (err: unknown) => {
        assert(err instanceof ProviderError);
        assert.match(err.message, /RAES_PROVIDER/);
        return true;
      }
    );
  });
});

test('loadProvider throws ProviderError when RAES_PROVIDER is unsupported', () => {
  withEnv({ RAES_PROVIDER: 'unknown-provider' }, () => {
    assert.throws(
      () => loadProvider(),
      (err: unknown) => {
        assert(err instanceof ProviderError);
        assert.match(err.message, /unsupported provider: unknown-provider/);
        assert.match(err.message, /anthropic, openai, local/);
        return true;
      }
    );
  });
});

test('anthropic provider throws ProviderError when ANTHROPIC_API_KEY is missing', () => {
  withEnv({ RAES_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: undefined }, () => {
    assert.throws(
      () => loadProvider(),
      (err: unknown) => {
        assert(err instanceof ProviderError);
        assert.match(err.message, /ANTHROPIC_API_KEY/);
        return true;
      }
    );
  });
});

test('openai provider throws ProviderError when OPENAI_API_KEY is missing', () => {
  withEnv({ RAES_PROVIDER: 'openai', OPENAI_API_KEY: undefined }, () => {
    assert.throws(
      () => loadProvider(),
      (err: unknown) => {
        assert(err instanceof ProviderError);
        assert.match(err.message, /OPENAI_API_KEY/);
        return true;
      }
    );
  });
});

test('local provider throws ProviderError when RAES_LOCAL_ENDPOINT is missing', () => {
  withEnv({ RAES_PROVIDER: 'local', RAES_LOCAL_ENDPOINT: undefined }, () => {
    assert.throws(
      () => loadProvider(),
      (err: unknown) => {
        assert(err instanceof ProviderError);
        assert.match(err.message, /RAES_LOCAL_ENDPOINT/);
        return true;
      }
    );
  });
});

test('anthropic provider complete() sends prompt to API and returns text', async (t) => {
  withEnv({ RAES_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key', RAES_MODEL: undefined }, () => {
    const provider = loadProvider();

    t.mock.method(globalThis, 'fetch', async (_url: string, _opts: RequestInit) => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'mocked completion' }]
      })
    }));

    return provider.complete('test prompt').then((result) => {
      assert.equal(result, 'mocked completion');
    });
  });
});

test('anthropic provider applies RAES_MODEL override when set', async (t) => {
  withEnv(
    { RAES_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key', RAES_MODEL: 'claude-custom-model' },
    () => {
      const provider = loadProvider();

      let capturedBody: Record<string, unknown> = {};
      t.mock.method(globalThis, 'fetch', async (_url: string, opts: RequestInit) => {
        capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>;
        return {
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'ok' }]
          })
        };
      });

      return provider.complete('prompt').then(() => {
        assert.equal(capturedBody['model'], 'claude-custom-model');
      });
    }
  );
});

test('--from-prd fails fast before file I/O when RAES_PROVIDER is unset', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-provider-cli-'));
  const prdFile = join(tempRoot, 'source.md');
  const targetProject = join(tempRoot, 'target');

  await writeFile(prdFile, '# Test PRD\n', 'utf8');

  const messages: string[] = [];
  const originalConsoleError = console.error;
  console.error = (m?: unknown) => {
    messages.push(String(m ?? ''));
  };

  let exitCode: number;
  try {
    exitCode = await (withEnv({ RAES_PROVIDER: undefined }, () =>
      main(['--from-prd', prdFile, targetProject, 'cli-doc-generator'])
    ) as Promise<number>);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(exitCode!, 1);
  assert.ok(
    messages.some((m) => m.includes('RAES_PROVIDER')),
    `expected error about RAES_PROVIDER, got: ${messages.join(', ')}`
  );
  await assert.rejects(
    readFile(join(targetProject, 'docs', 'prd.md'), 'utf8'),
    'no files should have been written'
  );
});
