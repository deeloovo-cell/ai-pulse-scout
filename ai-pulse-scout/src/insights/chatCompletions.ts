const DEFAULT_DEEPSEEK_BASE_URL = 'https://aigw.aac.tech/v1';
const DEFAULT_CHAT_TIMEOUT_MS = 20000;

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
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v3.2';
  const baseUrl =
    options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL;

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
  timeoutMs = DEFAULT_CHAT_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
      signal: controller.signal,
    });

    const payload = (await response.json()) as ChatCompletionsResult;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `LLM request failed with HTTP ${response.status}`);
    }

    return payload.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted) {
      throw new Error(`LLM request timed out after ${timeoutMs}ms`);
    }
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}
