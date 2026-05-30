import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { openPipelineDb, initializePipelineSchema } from '../state/db.js';
import { getItemReviewState, reviewItemExists, upsertItemReview } from '../state/reviewRepository.js';
import { listReviewFeedItems } from './reviewService.js';
import { renderReviewPage } from './renderReviewPage.js';

interface ReviewServerOptions {
  dbPath: string;
  now?: () => Date;
}

async function readJson(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function sendText(response: ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8'): void {
  response.statusCode = status;
  response.setHeader('content-type', contentType);
  response.end(body);
}

export function createReviewServer(options: ReviewServerOptions) {
  const now = options.now ?? (() => new Date());

  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? '/', 'http://review.local');
    const db = openPipelineDb(options.dbPath);
    initializePipelineSchema(db);

    try {
      if (request.method === 'GET' && requestUrl.pathname === '/') {
        const items = listReviewFeedItems(db, { now: now(), days: 5 });
        sendText(response, 200, renderReviewPage({ items }), 'text/html; charset=utf-8');
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/review-items') {
        const items = listReviewFeedItems(db, { now: now(), days: 5 });
        sendJson(response, 200, { items });
        return;
      }

      const ratingMatch = request.method === 'POST'
        ? requestUrl.pathname.match(/^\/api\/review-items\/([^/]+)\/rating$/)
        : null;
      if (ratingMatch) {
        const itemKey = decodeURIComponent(ratingMatch[1] ?? '');
        const body = await readJson(request) as { rating?: number | null };
        if (body.rating !== null && body.rating !== undefined && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
          sendText(response, 400, 'invalid rating');
          return;
        }
        if (!reviewItemExists(db, itemKey)) {
          sendText(response, 404, 'item not found');
          return;
        }
        const existing = getItemReviewState(db, itemKey);
        upsertItemReview(db, {
          itemKey,
          rating: body.rating ?? null,
          followUp: existing.followUp,
        });
        sendJson(response, 200, { ok: true });
        return;
      }

      const followUpMatch = request.method === 'POST'
        ? requestUrl.pathname.match(/^\/api\/review-items\/([^/]+)\/follow-up$/)
        : null;
      if (followUpMatch) {
        const itemKey = decodeURIComponent(followUpMatch[1] ?? '');
        const body = await readJson(request) as { followUp?: boolean };
        if (typeof body.followUp !== 'boolean') {
          sendText(response, 400, 'invalid followUp');
          return;
        }
        if (!reviewItemExists(db, itemKey)) {
          sendText(response, 404, 'item not found');
          return;
        }
        const existing = getItemReviewState(db, itemKey);
        upsertItemReview(db, {
          itemKey,
          rating: existing.rating,
          followUp: body.followUp,
        });
        sendJson(response, 200, { ok: true });
        return;
      }

      sendText(response, 404, 'not found');
    } finally {
      db.close();
    }
  };

  return {
    handler,
    listen(port: number) {
      return createServer((req, res) => {
        void handler(req, res);
      }).listen(port);
    },
    async fetch(path: string, init?: RequestInit): Promise<Response> {
      const server = createServer((req, res) => {
        void handler(req, res);
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        throw new Error('failed to bind review server');
      }
      try {
        return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
      } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    },
  };
}
