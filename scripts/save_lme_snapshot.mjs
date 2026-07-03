// エルメMCP（ログイン認証型・無人実行不可）でセッション内取得した値を記録するCLI。
// 使い方:
//   node scripts/save_lme_snapshot.mjs --friends 38 [--added 2] [--blocked 1] [--date 2026-07-03]
//   node scripts/save_lme_snapshot.mjs --broadcasts-json <配信一覧JSONファイル>
//     配信一覧JSON形式: [{"id":"...","name":"...","sentAt":"2026-07-01","recipients":38,"clicks":5}]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS_PATH = path.join(ROOT, 'data', 'snapshots.json');
const CONTENTS_PATH = path.join(ROOT, 'data', 'contents.json');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const date = arg('date') || new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('[lme] FAILED: --date must be YYYY-MM-DD');
  process.exit(1);
}

const friends = arg('friends');
const broadcastsFile = arg('broadcasts-json');
if (friends === undefined && !broadcastsFile) {
  console.error('[lme] FAILED: --friends または --broadcasts-json のどちらかは必須');
  process.exit(1);
}

if (friends !== undefined) {
  if (!/^\d+$/.test(friends)) {
    console.error('[lme] FAILED: --friends must be a non-negative integer');
    process.exit(1);
  }
  const snapshot = { date, friends: Number(friends) };
  const added = arg('added');
  const blocked = arg('blocked');
  if (added !== undefined) snapshot.added = Number(added);
  if (blocked !== undefined) snapshot.blocked = Number(blocked);

  const snapshots = readJson(SNAPSHOTS_PATH, { youtube: [], lme: [], x: [], facebook: [] });
  snapshots.lme = (snapshots.lme || []).filter((s) => s.date !== date);
  snapshots.lme.push(snapshot);
  snapshots.lme.sort((a, b) => (a.date < b.date ? -1 : 1));
  writeJson(SNAPSHOTS_PATH, snapshots);
  console.log(`[lme] ${date} friends=${snapshot.friends}` +
    (snapshot.added !== undefined ? ` added=${snapshot.added}` : '') +
    (snapshot.blocked !== undefined ? ` blocked=${snapshot.blocked}` : ''));
}

if (broadcastsFile) {
  const list = readJson(path.resolve(broadcastsFile), null);
  if (!Array.isArray(list)) {
    console.error('[lme] FAILED: broadcasts JSON must be an array');
    process.exit(1);
  }
  const contents = readJson(CONTENTS_PATH, { youtube: [], lme_broadcasts: [] });
  const existing = new Map((contents.lme_broadcasts || []).map((b) => [String(b.id), b]));
  for (const b of list) existing.set(String(b.id), b);
  contents.lme_broadcasts = [...existing.values()].sort((a, b) => ((a.sentAt || '') < (b.sentAt || '') ? 1 : -1));
  writeJson(CONTENTS_PATH, contents);
  console.log(`[lme] broadcasts merged: ${list.length} entries (total ${contents.lme_broadcasts.length})`);
}
