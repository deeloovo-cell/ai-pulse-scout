import type { PublishedAtConfidence } from './types.js';

export function normalizePublishedAt(rawValue?: string | null): {
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
} {
  if (!rawValue) {
    return {
      publishedAt: null,
      publishedAtConfidence: 'unknown',
    };
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(rawValue)) {
    return {
      publishedAt: new Date(rawValue).toISOString(),
      publishedAtConfidence: 'exact',
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return {
      publishedAt: new Date(`${rawValue}T00:00:00.000Z`).toISOString(),
      publishedAtConfidence: 'weak',
    };
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      publishedAt: parsed.toISOString(),
      publishedAtConfidence: 'inferred',
    };
  }

  return {
    publishedAt: null,
    publishedAtConfidence: 'unknown',
  };
}
