const DEFAULT_DEEPSEEK_BASE_URL = 'https://aigw.aac.tech/v1';

export interface ChatCompletionsResult {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface LlmClientConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

export function resolveLlmClient(options: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): LlmClientConfig | null {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? process.env.GLM_API_KEY;
  if (!apiKey) return null;

  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? process.env.GLM_MODEL ?? 'deepseek-v3.2';
  const baseUrl =
    options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? process.env.GLM_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL;

  return {
    apiKey,
    model,
    endpoint: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
  };
}

export async function requestChatCompletion(
  client: LlmClientConfig,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens = 800,
): Promise<string> {
  const response = await fetch(client.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: client.model,
      messages,
      thinking: { type: 'disabled' },
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });

  const payload = (await response.json()) as ChatCompletionsResult;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `LLM request failed with HTTP ${response.status}`);
  }

  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}
