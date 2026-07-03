import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS_PATH = path.join(ROOT, 'data', 'snapshots.json');
const CONTENTS_PATH = path.join(ROOT, 'data', 'contents.json');
const CREDENTIALS_PATH = process.env.YOUTUBE_OAUTH_CREDENTIALS || './credentials.json';
const TOKEN_PATH = process.env.YOUTUBE_OAUTH_TOKEN || './youtube-token.json';
// カンマ区切りで複数チャンネル指定（@は任意）
const CHANNEL_HANDLES = (process.env.YOUTUBE_CHANNEL_HANDLES || process.env.YOUTUBE_CHANNEL_HANDLE || '')
  .split(',').map((h) => h.trim().replace(/^@/, '')).filter(Boolean);

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function authClient() {
  const creds = readJson(CREDENTIALS_PATH);
  const token = readJson(TOKEN_PATH);
  if (!creds || !token) throw new Error(`OAuth credentials/token not found: ${CREDENTIALS_PATH} / ${TOKEN_PATH}`);
  const installed = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(installed.client_id, installed.client_secret, installed.redirect_uris?.[0]);
  auth.setCredentials(token);
  return auth;
}

async function collectChannel(youtube, handle) {
  const channelRes = await youtube.channels.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    forHandle: handle,
    maxResults: 1
  });
  const channel = channelRes.data.items?.[0];
  if (!channel) throw new Error(`No YouTube channel for handle @${handle}`);

  const stats = channel.statistics || {};
  const snapshot = {
    channel: handle,
    channelTitle: channel.snippet?.title || handle,
    subscribers: Number(stats.subscriberCount || 0),
    totalViews: Number(stats.viewCount || 0),
    videoCount: Number(stats.videoCount || 0)
  };

  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
  const videoIds = [];
  let pageToken;
  do {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsId,
      maxResults: 50,
      pageToken
    });
    videoIds.push(...(res.data.items || []).map((i) => i.contentDetails.videoId));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  const videos = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const res = await youtube.videos.list({
      part: ['snippet', 'statistics', 'status'],
      id: videoIds.slice(i, i + 50)
    });
    videos.push(...(res.data.items || []));
  }

  const contents = videos
    .filter((v) => v.status?.privacyStatus === 'public')
    .map((v) => ({
      channel: handle,
      id: v.id,
      title: v.snippet?.title || '',
      publishedAt: (v.snippet?.publishedAt || '').slice(0, 10),
      url: `https://www.youtube.com/watch?v=${v.id}`,
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0)
    }))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  return { snapshot, contents };
}

async function main() {
  if (!CHANNEL_HANDLES.length) throw new Error('YOUTUBE_CHANNEL_HANDLES is empty.');
  const youtube = google.youtube({ version: 'v3', auth: authClient() });
  const today = new Date().toISOString().slice(0, 10);

  const snapshots = readJson(SNAPSHOTS_PATH, { youtube: [], lme: [], x: [], facebook: [] });
  const contents = readJson(CONTENTS_PATH, { youtube: [], lme_broadcasts: [] });
  const allVideos = [];

  for (const handle of CHANNEL_HANDLES) {
    const result = await collectChannel(youtube, handle);
    snapshots.youtube = (snapshots.youtube || [])
      .filter((s) => !(s.date === today && (s.channel || CHANNEL_HANDLES[0]) === handle));
    snapshots.youtube.push({ date: today, ...result.snapshot });
    allVideos.push(...result.contents);
    console.log(`[youtube] ${today} @${handle} subscribers=${result.snapshot.subscribers} totalViews=${result.snapshot.totalViews} videos=${result.contents.length}`);
  }

  snapshots.youtube.sort((a, b) => (a.date === b.date ? (a.channel < b.channel ? -1 : 1) : a.date < b.date ? -1 : 1));
  writeJson(SNAPSHOTS_PATH, snapshots);

  contents.youtube = allVideos.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  writeJson(CONTENTS_PATH, contents);
}

main().catch((error) => {
  console.error('[youtube] FAILED: ' + error.message);
  process.exitCode = 1;
});
