#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const [,, pageId, bodyPath] = process.argv;
if (!pageId || !bodyPath) {
  console.error('Usage: node rewrite_kb_bilingual_colors.mjs <pageId> <bodyPath>');
  process.exit(1);
}

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

const raw = fs.readFileSync(bodyPath, 'utf8').replace(/\r\n/g, '\n');
const lines = raw.split('\n');

const blocks = [];

function makeParagraph(rich_text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text, color: 'default' }
  };
}

function pushPlainParagraph(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  blocks.push(makeParagraph([
    { type: 'text', text: { content: trimmed }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' } }
  ]));
}

function pushBilingualParagraph(en, zh) {
  blocks.push(makeParagraph([
    { type: 'text', text: { content: `EN: ${en}` }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'blue' } },
    { type: 'text', text: { content: `\nZH: ${zh}` }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'green' } }
  ]));
}

// Parse body file
let i = 0;
if (lines[0]?.trim()) {
  blocks.push({
    object: 'block',
    type: 'heading_1',
    heading_1: { rich_text: [{ type: 'text', text: { content: lines[0].trim() } }] }
  });
  i = 1;
}
// Skip raw URL line in page body to align with KB convention
if (lines[i]?.trim()?.startsWith('http')) i += 1;

let plainBuf = [];
let pendingEn = null;

function flushPlain() {
  const text = plainBuf.join('\n').trim();
  plainBuf = [];
  if (text) pushPlainParagraph(text);
}

for (; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (!trimmed) {
    flushPlain();
    continue;
  }
  if (trimmed.startsWith('EN: ')) {
    flushPlain();
    pendingEn = trimmed.slice(4).trim();
    continue;
  }
  if (trimmed.startsWith('ZH: ')) {
    const zh = trimmed.slice(4).trim();
    if (pendingEn) {
      pushBilingualParagraph(pendingEn, zh);
      pendingEn = null;
    } else {
      pushPlainParagraph(trimmed);
    }
    continue;
  }
  plainBuf.push(trimmed);
}
flushPlain();
if (pendingEn) pushPlainParagraph(`EN: ${pendingEn}`);

// Delete existing child blocks
const children = await notion.request(`/blocks/${pageId}/children?page_size=100`, { method: 'GET' });
for (const child of children.results || []) {
  await notion.request(`/blocks/${child.id}`, { method: 'DELETE' });
}

// Append new blocks in small batches
for (let start = 0; start < blocks.length; start += 20) {
  const batch = blocks.slice(start, start + 20);
  await notion.request(`/blocks/${pageId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children: batch })
  });
}

console.log(JSON.stringify({ ok: true, pageId, blockCount: blocks.length }, null, 2));
