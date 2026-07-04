// YouTube Analytics APIで過去365日の登録者数を復元してFirestoreに書き込む。
// 前提: setup_youtube_reauth.mjs で yt-analytics.readonly スコープを付与済み。
// 使い方: node scripts/backfill_youtube_analytics.mjs [--dry-run]
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREDENTIALS_PATH = process.env.YOUTUBE_OAUTH_CREDENTIALS
  || path.join(ROOT, 'credentials.json');
const TOKEN_PATH = process.env.YOUTUBE_OAUTH_TOKEN
  || 'C:/Users/WISE-Yamauchi/wise/pharmacist-reskilling-members/youtube-token.json';
const SA_PATH = process.env.RESKILLING_SERVICE_ACCOUNT
  || 'C:/Users/WISE-Yamauchi/Downloads/pharmacist-reskilling-members-firebase-adminsdk-fbsvc-149d19fe96.json';
const CHANNEL_HANDLES = (process.env.YOUTUBE_CHANNEL_HANDLES || '')
  .split(',').map(h => h.trim().replace(/^@/, '')).filter(Boolean);

const DRY_RUN = process.argv.includes('--dry-run');

function authClient() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(token);
  return auth;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function backfillChannel(youtube, analytics, handle) {
  // チャンネルID + 現在の登録者数取得
  const chRes = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    forHandle: handle,
    maxResults: 1,
  });
  const ch = chRes.data.items?.[0];
  if (!ch) throw new Error(`チャンネルが見つかりません: @${handle}`);

  const channelId = ch.id;
  const channelTitle = ch.snippet?.title || handle;
  const currentSubs = Number(ch.statistics?.subscriberCount || 0);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = addDays(today, -365);

  console.log(`[${handle}] ID=${channelId} 現在=${currentSubs}人 期間=${startDate}〜${today}`);

  // Analytics APIで日ごとの登録者増減取得
  let rows = [];
  try {
    const res = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      metrics: 'subscribersGained,subscribersLost',
      dimensions: 'day',
      sort: 'day',
    });
    rows = res.data.rows || [];
    console.log(`[${handle}] Analytics ${rows.length}日分取得`);
  } catch (e) {
    console.error(`[${handle}] Analytics取得失敗: ${e.message}`);
    console.error('  → このチャンネルが認証アカウントのチャンネルでない可能性があります');
    return [];
  }

  // 増減マップ作成: { 'YYYY-MM-DD': net }
  const netByDate = {};
  for (const [day, gained, lost] of rows) {
    netByDate[day] = (Number(gained) || 0) - (Number(lost) || 0);
  }

  // 今日から遡って各日の登録者数を復元
  const allDates = [];
  let d = today;
  while (d >= startDate) { allDates.push(d); d = addDays(d, -1); }
  // allDates[0]=today, allDates[1]=yesterday, ...

  const snapshots = [];
  let count = currentSubs;
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    snapshots.push({ date, channel: handle, channelTitle, subscribers: count });
    // 次の日（1日前）の登録者数 = 今日の登録者 - 今日の増減
    const net = netByDate[date] || 0;
    count = count - net;
    if (count < 0) count = 0;
  }

  // 日付昇順に並べ直す
  snapshots.reverse();
  console.log(`[${handle}] ${snapshots.length}点生成 (${snapshots[0].date}〜${snapshots[snapshots.length - 1].date})`);
  console.log(`  先頭: ${snapshots[0].date}=${snapshots[0].subscribers} 末尾: ${snapshots[snapshots.length - 1].date}=${snapshots[snapshots.length - 1].subscribers}`);
  return snapshots;
}

async function main() {
  if (!CHANNEL_HANDLES.length) throw new Error('YOUTUBE_CHANNEL_HANDLES が未設定');

  const auth = authClient();
  // スコープ確認
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  if (!(token.scope || '').includes('yt-analytics')) {
    console.error('❌ yt-analytics スコープがありません。先に setup_youtube_reauth.mjs を実行してください');
    process.exit(1);
  }

  const youtube = google.youtube({ version: 'v3', auth });
  const analytics = google.youtubeAnalytics({ version: 'v2', auth });

  const allSnapshots = [];
  for (const handle of CHANNEL_HANDLES) {
    const pts = await backfillChannel(youtube, analytics, handle);
    allSnapshots.push(...pts);
  }

  if (!allSnapshots.length) {
    console.log('バックフィルするデータがありません');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Firestoreへの書込はスキップ。--dry-runを外して本実行してください');
    process.exit(0);
  }

  // Firestoreに書き込み（sns_data/snapshots の youtube 配列を更新）
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))) });
  const db = getFirestore();
  const ref = db.collection('sns_data').doc('snapshots');
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data().youtube || []) : [];

  // 既存データとマージ（同じdate+channelは上書き）
  const map = {};
  for (const s of existing) map[`${s.date}:${s.channel}`] = s;
  for (const s of allSnapshots) map[`${s.date}:${s.channel}`] = s;
  const merged = Object.values(map).sort((a, b) =>
    a.date === b.date ? (a.channel < b.channel ? -1 : 1) : a.date < b.date ? -1 : 1
  );

  await ref.set({ youtube: merged }, { merge: true });
  console.log(`\n✅ Firestore更新完了: youtube ${merged.length}点（バックフィル ${allSnapshots.length}点追加）`);
}

main().catch(e => { console.error('FAILED:', e.message); process.exitCode = 1; });
