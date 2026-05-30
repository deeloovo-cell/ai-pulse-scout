import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { saveDigestReviewItems } from '../../src/state/reviewRepository.js';
import { createReviewServer } from '../../src/web/reviewServer.js';

describe('reviewServer', () => {
  it('serves review items and persists rating/follow-up updates', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-server-'));
    const dbPath = join(dir, 'pipeline.sqlite');
    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);
    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        { itemKey: 'item-1', publishedAt: '2026-05-30T10:00:00.000Z', title: 'Alpha item', excerpt: 'Alpha excerpt', itemUrl: 'https://example.com/a', sourceName: 'Example', topicTags: ['AI'], matchScore: 0.92, normalizedItemJson: '{}' },
      ],
    });
    db.close();

    const server = createReviewServer({ dbPath, now: () => new Date('2026-05-30T12:00:00.000Z') });

    const listResponse = await server.fetch('/api/review-items');
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      items: [{ itemKey: 'item-1', rating: null, followUp: false }],
    });

    const ratingResponse = await server.fetch('/api/review-items/item-1/rating', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    });
    expect(ratingResponse.status).toBe(200);

    const followUpResponse = await server.fetch('/api/review-items/item-1/follow-up', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ followUp: true }),
    });
    expect(followUpResponse.status).toBe(200);

    const updatedList = await (await server.fetch('/api/review-items')).json();
    expect(updatedList.items[0]).toMatchObject({ rating: 5, followUp: true });
  });

  it('renders review items in published date ascending order with persisted values in markup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-server-html-'));
    const dbPath = join(dir, 'pipeline.sqlite');
    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);
    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        { itemKey: 'newer', publishedAt: '2026-05-30T10:00:00.000Z', title: 'Newer item', excerpt: 'Newer excerpt', itemUrl: 'https://example.com/newer', sourceName: 'Example', topicTags: ['AI'], matchScore: 0.92, normalizedItemJson: '{}' },
        { itemKey: 'older', publishedAt: '2026-05-29T10:00:00.000Z', title: 'Older item', excerpt: 'Older excerpt', itemUrl: 'https://example.com/older', sourceName: 'Example', topicTags: ['ML'], matchScore: 0.88, normalizedItemJson: '{}' },
      ],
    });
    db.close();

    const server = createReviewServer({ dbPath, now: () => new Date('2026-05-30T12:00:00.000Z') });
    await server.fetch('/api/review-items/older/rating', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    });
    await server.fetch('/api/review-items/older/follow-up', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ followUp: true }),
    });

    const response = await server.fetch('/');
    const html = await response.text();

    expect(html.indexOf('Older item')).toBeLessThan(html.indexOf('Newer item'));
    expect(html).toContain('data-rating="5"');
    expect(html).toContain('checked');
  });

  it('rejects invalid rating values', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-server-invalid-'));
    const dbPath = join(dir, 'pipeline.sqlite');
    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);
    db.close();

    const server = createReviewServer({ dbPath, now: () => new Date('2026-05-30T12:00:00.000Z') });
    const response = await server.fetch('/api/review-items/missing/rating', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 99 }),
    });
    expect(response.status).toBe(400);
  });
});
