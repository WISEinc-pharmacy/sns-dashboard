// SNSダッシュボードアクセス承認/拒否。確認キューのinstruction経由で麗華が呼び出す。
// 使い方: node grant_sns_access.mjs --email user@example.com --action 承認|拒否
import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const SA_PATH = process.env.RESKILLING_SERVICE_ACCOUNT
  || 'C:/Users/WISE-Yamauchi/Downloads/pharmacist-reskilling-members-firebase-adminsdk-fbsvc-149d19fe96.json';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
}

const { email, action } = args;
if (!email || !action) {
  console.error('使い方: node grant_sns_access.mjs --email <email> --action 承認|拒否');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))) });
const db = getFirestore();

if (action === '承認') {
  await db.collection('users').doc(email).set(
    { email, snsAccess: true, status: 'active', updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  try {
    await db.collection('access_requests').doc(email).update({
      status: 'approved',
      approvedAt: FieldValue.serverTimestamp(),
    });
  } catch { /* 申請ドキュメントが消えていても権限付与は成功とする */ }
  console.log(`✅ ${email} のSNSアクセスを承認（snsAccess=true）`);

} else if (action === '拒否') {
  try {
    await db.collection('access_requests').doc(email).update({
      status: 'rejected',
      rejectedAt: FieldValue.serverTimestamp(),
    });
  } catch { /* noop */ }
  console.log(`❌ ${email} の申請を拒否`);

} else {
  console.error(`不明なaction: ${action}（承認 または 拒否 を指定）`);
  process.exit(1);
}
process.exit(0);
