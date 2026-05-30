import { NotionClient } from '/Users/aactest/Desktop/skills/notion-api/notion-client.js';
const notion = new NotionClient();
const pageId='355ec093-c49c-8100-89c6-c71f98ce4a68';
const children = await notion.request(`/blocks/${pageId}/children?page_size=10`);
console.log('children', JSON.stringify(children.results.map(b=>({id:b.id,type:b.type,text:b[b.type]?.rich_text?.[0]?.plain_text||''})), null, 2));
