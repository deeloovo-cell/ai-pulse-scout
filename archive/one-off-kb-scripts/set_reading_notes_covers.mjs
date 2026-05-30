import { NotionClient } from '/Users/aactest/Desktop/skills/notion-api/notion-client.js';

const notion = new NotionClient();
const DATABASE_ID = '355ec093-c49c-81df-854f-e1d47894f549';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function queryAllPages() {
  const out = [];
  let cursor;
  while (true) {
    const resp = await notion.request(`/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 })
    });
    out.push(...resp.results);
    if (!resp.has_more) break;
    cursor = resp.next_cursor;
  }
  return out;
}

function getTitle(page) {
  return page.properties?.Title?.title?.[0]?.plain_text || '';
}
function getAuthor(page) {
  return page.properties?.Author?.rich_text?.[0]?.plain_text || '';
}

function cleanTitleForQuery(title) {
  return String(title)
    .replace(/[《》]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/loc\.\s*\d+[\-–]\d+/gi, ' ')
    .replace(/—.*$/g, ' ')
    .replace(/——.*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 OpenClaw Reading Notes Importer',
      'Accept': 'application/json,text/plain,*/*'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function findCoverGoogle(title, author='') {
  const q = encodeURIComponent(`${cleanTitleForQuery(title)} ${author}`.trim());
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&printType=books`;
  const data = await fetchJson(url);
  const items = data.items || [];
  for (const item of items) {
    const info = item.volumeInfo || {};
    const img = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
    if (!img) continue;
    return img.replace(/^http:/, 'https:').replace(/&edge=curl/g, '');
  }
  return null;
}

async function findCoverOpenLibrary(title) {
  const q = encodeURIComponent(cleanTitleForQuery(title));
  const url = `https://openlibrary.org/search.json?title=${q}&limit=5`;
  const data = await fetchJson(url);
  const docs = data.docs || [];
  for (const doc of docs) {
    if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    if (doc.isbn?.[0]) return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    if (doc.olid?.[0]) return `https://covers.openlibrary.org/b/olid/${doc.olid[0]}-L.jpg`;
  }
  return null;
}

async function findCover(title, author='') {
  try {
    const g = await findCoverGoogle(title, author);
    if (g) return { url: g, source: 'google_books' };
  } catch {}
  try {
    const o = await findCoverOpenLibrary(title);
    if (o) return { url: o, source: 'openlibrary' };
  } catch {}
  return null;
}

async function getChildren(pageId) {
  const resp = await notion.request(`/blocks/${pageId}/children?page_size=20`);
  return resp.results || [];
}

async function deleteBlock(blockId) {
  return notion.request(`/blocks/${blockId}`, { method: 'DELETE' });
}

async function stripImportIntro(pageId) {
  const children = await getChildren(pageId);
  const toDelete = [];
  if (children[0]?.type === 'heading_2' && (children[0].heading_2?.rich_text?.[0]?.plain_text || '') === '导入说明') {
    toDelete.push(children[0].id);
    if (children[1]?.type === 'paragraph') toDelete.push(children[1].id);
    if (children[2]?.type === 'divider') toDelete.push(children[2].id);
  }
  for (const id of toDelete) {
    try { await deleteBlock(id); } catch {}
    await sleep(120);
  }
  return toDelete.length;
}

async function setPageCover(pageId, coverUrl) {
  return notion.request(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      cover: {
        type: 'external',
        external: { url: coverUrl }
      }
    })
  });
}

const pages = await queryAllPages();
let updated = 0;
let introRemoved = 0;
const missing = [];
const failed = [];

for (const page of pages) {
  const id = page.id;
  const title = getTitle(page);
  const author = getAuthor(page);
  try {
    const cover = await findCover(title, author);
    const removed = await stripImportIntro(id);
    if (removed) introRemoved += 1;
    if (!cover) {
      missing.push({ title, author, id });
      console.log(`MISS\t${title}`);
      await sleep(200);
      continue;
    }
    await setPageCover(id, cover.url);
    updated += 1;
    console.log(`OK\t${title}\t${cover.source}`);
    await sleep(250);
  } catch (e) {
    failed.push({ title, author, id, error: String(e).slice(0, 300) });
    console.log(`FAIL\t${title}\t${String(e).slice(0,120)}`);
    await sleep(300);
  }
}

console.log(JSON.stringify({ total: pages.length, updated, introRemoved, missing: missing.slice(0, 80), failed: failed.slice(0, 40) }, null, 2));
