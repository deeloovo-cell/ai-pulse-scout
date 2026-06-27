import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  defaultSelectedSnapshotPath,
  readSelectedSnapshot,
  writeSelectedSnapshot,
} from '../../src/static/selectedSnapshot.js';

describe('selectedSnapshot', () => {
  it('writes selected items to the default snapshot path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'selected-snapshot-default-'));
    const snapshotPath = defaultSelectedSnapshotPath(dir, '2026-06-27');
    const items = [
      {
        id: '1',
        source_name: 'Example',
        source_category: 'blog',
        source_url: 'https://example.com/feed.xml',
        item_url: 'https://example.com/post-1',
        title: 'Post 1',
        published_at: null,
        fetched_at: new Date('2026-06-27T00:00:00.000Z'),
        author: '',
        content_text: 'Hello',
        content_html: undefined,
        summary: 'Hello',
        tags: [],
        content_type: 'article',
        fingerprint: 'fp-1',
        relevance_scores: {
          ai_engineering: 0,
          industrial_ai: 0,
          cad_cae_cam: 0,
          executive_signal: 0,
          aac_relevance: 0,
          overall: 0,
        },
        decision: 'pending',
        decision_reason: '',
        primary_topic: 'AI Developer Tools & Agents',
      },
    ];

    await writeSelectedSnapshot(snapshotPath, items);
    const saved = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Array<{ title: string }>;
    expect(saved[0]?.title).toBe('Post 1');

    rmSync(dir, { recursive: true, force: true });
  });

  it('resolves the default selected snapshot path for a digest date', () => {
    expect(defaultSelectedSnapshotPath('/repo/data/output/site', '2026-06-27')).toBe(
      '/repo/data/output/site/selected-2026-06-27.json',
    );
  });

  it('writes and reads selected items as json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'selected-snapshot-'));
    const snapshotPath = join(dir, 'selected-2026-06-27.json');
    const items = [
      {
        id: '1',
        source_name: 'Example',
        source_category: 'blog',
        source_url: 'https://example.com/feed.xml',
        item_url: 'https://example.com/post-1',
        title: 'Post 1',
        published_at: null,
        fetched_at: new Date('2026-06-27T00:00:00.000Z'),
        author: '',
        content_text: 'Hello',
        content_html: undefined,
        summary: 'Hello',
        tags: [],
        content_type: 'article',
        fingerprint: 'fp-1',
        relevance_scores: {
          ai_engineering: 0,
          industrial_ai: 0,
          cad_cae_cam: 0,
          executive_signal: 0,
          aac_relevance: 0,
          overall: 0,
        },
        decision: 'pending',
        decision_reason: '',
        primary_topic: 'AI Developer Tools & Agents',
      },
    ];

    await writeSelectedSnapshot(snapshotPath, items);
    const loaded = await readSelectedSnapshot(snapshotPath);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe('Post 1');
    expect(loaded[0]?.fetched_at).toBeInstanceOf(Date);

    rmSync(dir, { recursive: true, force: true });
  });
});
