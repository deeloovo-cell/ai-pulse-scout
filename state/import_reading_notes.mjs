import fs from 'fs';
import { NotionClient } from '/Users/aactest/Desktop/skills/notion-api/notion-client.js';

const HTML_PATH = '/Users/aactest/.openclaw/media/inbound/é_ºå_å_ä_å_ä_ç_ç_è---07df73bf-9495-4c25-b884-c50f7f65e616.html';
const DATABASE_ID = '355ec093-c49c-81df-854f-e1d47894f549';

const html = fs.readFileSync(HTML_PATH, 'utf8');

class MemoParser {
  constructor() {
    this.memos = [];
  }
  parse(html) {
    const memoRe = /<div class="memo">([\s\S]*?)<div class="files">[\s\S]*?<\/div>\s*<\/div>/g;
    let m;
    while ((m = memoRe.exec(html))) {
      const block = m[1];
      const time = (block.match(/<div class="time">([\s\S]*?)<\/div>/) || [,''])[1].replace(/<[^>]+>/g, '').trim();
      const paragraphs = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(x => this.clean(x[1]));
      this.memos.push({ time, paragraphs });
    }
    return this.memos;
  }
  clean(s) {
    return s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
  }
}

function normalizeTitle(raw) {
  let title = raw.trim();
  if (title.startsWith('#')) title = title.slice(1).trim();
  title = title.replace(/^\s+|\s+$/g, '');
  if (/^《[^》]+》\/.+/.test(title)) {
    const m = title.match(/^(《[^》]+》)\/(.+)$/);
    return { title: m[1].replace(/[《》]/g, ''), subTitle: m[2].trim(), rawTitle: title };
  }
  if (title.includes(' - ')) {
    const parts = title.split(/\s-\s/);
    if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1 && parts[1].length < 30) {
      return { title: parts[0].replace(/[《》]/g, '').trim(), authorFromTitle: parts[1].trim(), rawTitle: title };
    }
  }
  return { title: title.replace(/[《》]/g, '').trim(), rawTitle: title };
}

function looksLikeAuthor(s) {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  if (t.startsWith('◆') || t.startsWith('原文：') || t.startsWith('http')) return false;
  if (t === '-- 来自微信读书') return false;
  if (/\d{4}[年\/-]\d{1,2}/.test(t)) return false;
  if (/星期[一二三四五六日天]/.test(t)) return false;
  if (/个笔记/.test(t)) return false;
  if (t.length > 40) return false;
  return /[\u4e00-\u9fa5A-Za-z\[\]·•.]/.test(t);
}

function isNonBook(title) {
  const deny = ['宽带', '基金转账'];
  return deny.includes(title.trim());
}

function shortText(s, max=1800) {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function chunkText(text, maxLen = 1800) {
  const lines = String(text || '').split(/\n/).filter(Boolean);
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? cur + '\n' + line : line;
    if (next.length > maxLen && cur) {
      chunks.push(cur);
      cur = line;
    } else if (line.length > maxLen) {
      if (cur) chunks.push(cur);
      for (let i = 0; i < line.length; i += maxLen) chunks.push(line.slice(i, i + maxLen));
      cur = '';
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

const parser = new MemoParser();
const memos = parser.parse(html);
const books = new Map();

for (const memo of memos) {
  const paragraphs = memo.paragraphs.filter(Boolean);
  if (!paragraphs.length) continue;
  const first = paragraphs[0];
  if (!first.startsWith('#')) continue;
  const norm = normalizeTitle(first);
  if (isNonBook(norm.title)) continue;
  let author = norm.authorFromTitle || '';
  if (!author) {
    const p2 = paragraphs[1] || '';
    const p3 = paragraphs[2] || '';
    if (looksLikeAuthor(p2) && (/个笔记/.test(p3) || p3 === '-- 来自微信读书' || !p3 || p3.startsWith('◆') || p3.startsWith('第一') || p3.startsWith('点评'))) {
      author = p2.trim();
    } else if (looksLikeAuthor(p2) && /^[\[\]A-Za-z\u4e00-\u9fa5·•.]{2,30}$/.test(p2)) {
      author = p2.trim();
    }
  }
  const key = `${norm.title}|||${author}`;
  if (!books.has(key)) {
    books.set(key, {
      title: norm.title,
      author,
      rawTitles: new Set(),
      memos: [],
      firstNoteDate: memo.time ? memo.time.slice(0, 10) : null,
      tags: new Set(),
    });
  }
  const entry = books.get(key);
  entry.rawTitles.add(norm.rawTitle || first);
  if (norm.subTitle) entry.tags.add(norm.subTitle);
  entry.memos.push({
    time: memo.time,
    rawTitle: norm.rawTitle || first,
    subTitle: norm.subTitle || '',
    paragraphs,
  });
  if (memo.time && (!entry.firstNoteDate || memo.time.slice(0,10) < entry.firstNoteDate)) {
    entry.firstNoteDate = memo.time.slice(0,10);
  }
}

const notion = new NotionClient();

async function existingTitles() {
  const titles = new Set();
  let startCursor = undefined;
  while (true) {
    const resp = await notion.request(`/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(startCursor ? { start_cursor: startCursor, page_size: 100 } : { page_size: 100 })
    });
    for (const r of resp.results || []) {
      const title = r.properties?.Title?.title?.[0]?.plain_text;
      const author = r.properties?.Author?.rich_text?.[0]?.plain_text || '';
      if (title) titles.add(`${title}|||${author}`);
    }
    if (!resp.has_more) break;
    startCursor = resp.next_cursor;
  }
  return titles;
}

function buildChildren(book) {
  const children = [];
  children.push({ object:'block', type:'heading_2', heading_2:{ rich_text:[{ type:'text', text:{ content:'导入说明' } }] } });
  children.push({ object:'block', type:'paragraph', paragraph:{ rich_text:[{ type:'text', text:{ content:`原始 memo 数：${book.memos.length}；原始标题数：${book.rawTitles.size}` } }] } });
  for (const memo of book.memos.sort((a,b)=>a.time.localeCompare(b.time))) {
    children.push({ object:'block', type:'divider', divider:{} });
    const heading = [memo.time, memo.subTitle ? `｜${memo.subTitle}` : '', `｜${memo.rawTitle}`].join('');
    children.push({ object:'block', type:'heading_3', heading_3:{ rich_text:[{ type:'text', text:{ content: shortText(heading, 180) } }] } });
    const body = memo.paragraphs.join('\n');
    for (const chunk of chunkText(body, 1800).slice(0, 20)) {
      children.push({ object:'block', type:'paragraph', paragraph:{ rich_text:[{ type:'text', text:{ content: chunk } }] } });
    }
  }
  return children.slice(0, 100);
}

const existing = await existingTitles();
let created = 0;
let skipped = 0;
const report = [];

for (const [key, book] of books) {
  if (existing.has(key)) { skipped++; continue; }
  const properties = {
    Title: { title: [{ type: 'text', text: { content: book.title.slice(0, 2000) } }] },
    Author: { rich_text: book.author ? [{ type: 'text', text: { content: book.author.slice(0, 2000) } }] : [] },
    'Source Count': { number: book.memos.length },
    'First Note Date': book.firstNoteDate ? { date: { start: book.firstNoteDate } } : { date: null },
    Status: { select: { name: 'Imported' } },
    'Raw Title': { rich_text: [{ type: 'text', text: { content: [...book.rawTitles].join(' | ').slice(0, 2000) } }] },
    Tags: { multi_select: [...book.tags].slice(0, 20).map(name => ({ name: name.slice(0, 100) })) },
  };
  const body = {
    parent: { database_id: DATABASE_ID },
    properties,
    children: buildChildren(book),
  };
  const res = await notion.request('/pages', { method: 'POST', body: JSON.stringify(body) });
  created++;
  report.push({ title: book.title, author: book.author, id: res.id, url: res.url, count: book.memos.length });
  if (created % 10 === 0) console.log(`CREATED ${created}`);
}

console.log(JSON.stringify({ totalBooks: books.size, created, skipped, sample: report.slice(0, 20) }, null, 2));
