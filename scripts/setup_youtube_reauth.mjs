// YouTube Analytics スコープ追加のための再認証スクリプト。
// 実行後に youtube-token.json が上書きされ、バックフィルが使えるようになる。
// 使い方: node scripts/setup_youtube_reauth.mjs
import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline';
import { google } from 'googleapis';

const CREDENTIALS_PATH = process.env.YOUTUBE_OAUTH_CREDENTIALS
  || 'C:/Users/WISE-Yamauchi/wise/sns-dashboard/credentials.json';
const TOKEN_PATH = process.env.YOUTUBE_OAUTH_TOKEN
  || 'C:/Users/WISE-Yamauchi/wise/pharmacist-reskilling-members/youtube-token.json';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const url = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
console.log('\n=== YouTube Analytics 再認証 ===');
console.log('\n以下のURLをブラウザで開いてください:\n');
console.log(url);
console.log('\n認証後に表示されるコードを貼り付けてください:');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('コード: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await auth.getToken(code.trim());
    const backup = TOKEN_PATH + '.backup';
    if (fs.existsSync(TOKEN_PATH)) fs.copyFileSync(TOKEN_PATH, backup);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
    console.log(`\n✅ トークン保存完了: ${TOKEN_PATH}`);
    console.log('バックアップ:', backup);
    console.log('追加スコープ: yt-analytics.readonly');
    console.log('\n次のステップ: node scripts/backfill_youtube_analytics.mjs');
  } catch (e) {
    console.error('❌ トークン取得失敗:', e.message);
    process.exitCode = 1;
  }
});
