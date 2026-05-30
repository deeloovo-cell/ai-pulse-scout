import 'dotenv/config';
import { runPipeline } from '../jobs/runPipeline.js';

const result = await runPipeline({
  now: new Date(),
  ingest: async () => ({ items: [] }),
  fetchItem: async () => ({ rawContent: '', cleanContent: '', fetchMethod: 'noop' }),
  enrichItem: async () => ({
    summary: '',
    whyItMatters: '',
    topics: [],
    relevanceScore: 0,
    relevanceBucket: 'low',
    rawResponse: '{}',
    model: 'noop',
    durationMs: 0,
  }),
  render: () => '<html></html>',
  publish: async () => undefined,
});

console.log(JSON.stringify(result, null, 2));
