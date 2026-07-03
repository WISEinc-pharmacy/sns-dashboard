// data/snapshots.json + data/contents.json を Firestore（pharmacist-reskilling-members）の
// sns_data コレクションへ反映する。ローカルJSONが作業コピー、Firestoreが配信用DB。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SA_PATH = process.env.RESKILLING_SERVICE_ACCOUNT
  || 'C:/Users/WISE-Yamauchi/Downloads/pharmacist-reskilling-members-firebase-adminsdk-fbsvc-149d19fe96.json';

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))) });
const db = getFirestore();

const snapshots = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'snapshots.json'), 'utf8'));
const contents = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'contents.json'), 'utf8'));

const updatedAt = new Date().toISOString();
await db.collection('sns_data').doc('snapshots').set({ ...snapshots, updatedAt });
await db.collection('sns_data').doc('contents').set({ ...contents, updatedAt });
console.log(`[firestore] sns_data updated: youtube_snap=${snapshots.youtube.length} lme=${snapshots.lme.length} videos=${contents.youtube.length} broadcasts=${contents.lme_broadcasts.length}`);
process.exit(0);
