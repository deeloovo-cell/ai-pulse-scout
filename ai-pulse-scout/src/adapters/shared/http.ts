export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AI-Pulse-Scout/0.1; +https://github.com/deeloovo-cell/ai-pulse-scout)',
      },
    });

    if (!response.ok) {
      throw new Error(`Status code ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
