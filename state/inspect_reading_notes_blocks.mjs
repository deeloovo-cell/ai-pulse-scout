import { NotionClient } from '/Users/aactest/Desktop/skills/notion-api/notion-client.js';
const notion = new NotionClient();
const db='355ec093-c49c-81df-854f-e1d47894f549';
const resp = await notion.request(`/databases/${db}/query`, {method:'POST', body: JSON.stringify({page_size:5})});
for (const r of resp.results) {
  console.log(JSON.stringify({id:r.id,title:r.properties.Title?.title?.[0]?.plain_text||'', author:r.properties.Author?.rich_text?.[0]?.plain_text||''}, null, 2));
  const ch = await notion.request(`/blocks/${r.id}/children?page_size=10`);
  console.log(JSON.stringify(ch.results.map(b=>({id:b.id,type:b.type, text:b[b.type]?.rich_text?.[0]?.plain_text || ''})), null, 2));
  break;
}
