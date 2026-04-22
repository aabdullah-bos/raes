export type Provider = {
  complete(prompt: string): Promise<string>;
};

export class ProviderError extends Error {}

const SUPPORTED_PROVIDERS = ['anthropic', 'openai', 'local'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function loadProvider(): Provider {
  const name = process.env['RAES_PROVIDER'];
  if (!name) {
    throw new ProviderError(
      `RAES_PROVIDER is required for --from-prd mode (supported: ${SUPPORTED_PROVIDERS.join(', ')})`
    );
  }

  if (!SUPPORTED_PROVIDERS.includes(name as SupportedProvider)) {
    throw new ProviderError(
      `unsupported provider: ${name} (supported: ${SUPPORTED_PROVIDERS.join(', ')})`
    );
  }

  const model = process.env['RAES_MODEL'];

  switch (name as SupportedProvider) {
    case 'anthropic':
      return makeAnthropicProvider(model);
    case 'openai':
      return makeOpenAiProvider(model);
    case 'local':
      return makeLocalProvider(model);
  }
}

function makeAnthropicProvider(model?: string): Provider {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new ProviderError('ANTHROPIC_API_KEY is required for the anthropic provider');
  }

  const resolvedModel = model ?? 'claude-haiku-4-5-20251001';

  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: resolvedModel,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new ProviderError(
          `anthropic request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = data.content.find((b) => b.type === 'text')?.text;
      if (!text) {
        throw new ProviderError('anthropic response contained no text content');
      }
      return text;
    }
  };
}

function makeOpenAiProvider(model?: string): Provider {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new ProviderError('OPENAI_API_KEY is required for the openai provider');
  }

  const resolvedModel = model ?? 'gpt-4o-mini';

  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new ProviderError(`openai request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const text = data.choices[0]?.message?.content;
      if (!text) {
        throw new ProviderError('openai response contained no text content');
      }
      return text;
    }
  };
}

function makeLocalProvider(model?: string): Provider {
  const endpoint = process.env['RAES_LOCAL_ENDPOINT'];
  if (!endpoint) {
    throw new ProviderError('RAES_LOCAL_ENDPOINT is required for the local provider');
  }

  const resolvedModel = model ?? 'llama3';

  return {
    async complete(prompt: string): Promise<string> {
      const url = `${endpoint.replace(/\/$/, '')}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new ProviderError(
          `local provider request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const text = data.choices[0]?.message?.content;
      if (!text) {
        throw new ProviderError('local provider response contained no text content');
      }
      return text;
    }
  };
}
