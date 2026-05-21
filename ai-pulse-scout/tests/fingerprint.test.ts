import { describe, it, expect } from 'vitest';
import { fingerprint, canonicalizeUrl } from '../src/normalize/fingerprint.js';

describe('fingerprint', () => {
  it('returns a 16-char hex string', () => {
    const fp = fingerprint('https://example.com/article', 'Hello World');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable for the same inputs', () => {
    const fp1 = fingerprint('https://example.com/a', 'Title A');
    const fp2 = fingerprint('https://example.com/a', 'Title A');
    expect(fp1).toBe(fp2);
  });

  it('differs for different URLs', () => {
    const fp1 = fingerprint('https://example.com/a', 'Same Title');
    const fp2 = fingerprint('https://example.com/b', 'Same Title');
    expect(fp1).not.toBe(fp2);
  });

  it('differs for different titles', () => {
    const fp1 = fingerprint('https://example.com/a', 'Title One');
    const fp2 = fingerprint('https://example.com/a', 'Title Two');
    expect(fp1).not.toBe(fp2);
  });

  it('is case-insensitive for titles', () => {
    const fp1 = fingerprint('https://example.com/a', 'Hello World');
    const fp2 = fingerprint('https://example.com/a', 'HELLO WORLD');
    expect(fp1).toBe(fp2);
  });
});

describe('canonicalizeUrl', () => {
  it('strips utm_ params', () => {
    const url = 'https://example.com/article?utm_source=email&utm_medium=newsletter';
    expect(canonicalizeUrl(url)).toBe('https://example.com/article');
  });

  it('strips trailing slash', () => {
    expect(canonicalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('lowercases the URL', () => {
    expect(canonicalizeUrl('https://Example.COM/Path')).toBe('https://example.com/path');
  });

  it('handles invalid URLs gracefully', () => {
    const result = canonicalizeUrl('not-a-url');
    expect(result).toBe('not-a-url');
  });

  it('strips ref param', () => {
    expect(canonicalizeUrl('https://example.com/page?ref=home')).toBe('https://example.com/page');
  });
});
