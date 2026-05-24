#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const notionApiDir = '/Users/aactest/Desktop/skills/notion-api';
const envPath = path.join(notionApiDir, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { NotionClient } = await import('/Users/aactest/Desktop/skills/notion-api/notion-client.js');
const notion = new NotionClient();

const [,, databaseId, title, url, tagsJson, summary, bodyPath] = process.argv;
if (!databaseId || !title || !url) {
  console.error('Usage: node tmp_create_kb_record.mjs <databaseId> <title> <url> [tagsJson] [summary] [bodyPath]');
  process.exit(1);
}
const tags = tagsJson ? JSON.parse(tagsJson) : [];
const body = bodyPath && fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : '';
const children = [];
if (summary) {
  children.push({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: summary.slice(0, 1900) } }] }
  });
}
if (body) {
  const chunks = [];
  let buf = '';
  for (const line of body.split(/\r?\n/)) {
    const next = buf ? buf + '\n' + line : line;
    if (next.length > 1800 && buf) { chunks.push(buf); buf = line; }
    else buf = next;
  }
  if (buf) chunks.push(buf);
  for (const chunk of chunks.slice(0, 80)) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] }
    });
  }
}
const props = {
  '标题': { title: [{ type: 'text', text: { content: title.slice(0, 200) } }] },
  'URL': { url },
  '创建日期': { date: { start: new Date().toISOString() } }
};
if (tags.length) props['Tags'] = { multi_select: tags.map(name => ({ name })) };
const res = await notion.request('/pages', {
  method: 'POST',
  body: JSON.stringify({
    parent: { database_id: databaseId },
    properties: props,
    children
  })
});
console.log(JSON.stringify({ id: res.id, url: res.url }, null, 2));
