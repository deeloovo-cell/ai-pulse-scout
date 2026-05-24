import { NotionClient } from '/Users/aactest/Desktop/skills/notion-api/notion-client.js';
const notion = new NotionClient();
const db='355ec093-c49c-81df-854f-e1d47894f549';
try {
  const resp = await notion.request(`/databases/${db}/query`, {method:'POST', body: JSON.stringify({page_size:3})});
  console.log(JSON.stringify(resp.results.map(r => ({id:r.id, title:r.properties?.Title?.title?.[0]?.plain_text || '', author:r.properties?.Author?.rich_text?.[0]?.plain_text || ''})), null, 2));
} catch (e) {
  console.error(String(e));
  process.exit(1);
}
