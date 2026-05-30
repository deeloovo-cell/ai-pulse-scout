import { createReviewServer } from '../web/reviewServer.js';

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.PIPELINE_DB_PATH ?? 'data/state/pipeline.sqlite';

createReviewServer({ dbPath }).listen(port);
console.log(`AI Pulse Scout review server running at http://localhost:${port}`);
