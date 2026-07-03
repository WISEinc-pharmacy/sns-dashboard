// SNSアクセス申請（Firestore access_requests）を監視→confirmation_queueへ登録。
// タスクスケジューラで15分おきに実行。申請が来ると麗華がurgenDMで山内さんに提示する。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SA_PATH = process.env.RESKILLING_SERVICE_ACCOUNT
  || 'C:/Users/WISE-Yamauchi/Downloads/pharmacist-reskilling-members-firebase-adminsdk-fbsvc-149d19fe96.json';

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('access_requests').where('status', '==', 'pending').get();
let queued = 0;

for (const doc of snap.docs) {
  const req = doc.data();
  const email = doc.id;
  const name = req.name || email;
  const dedupeKey = `sns-access:${email}`;
  const grantScript = `C:/Users/WISE-Yamauchi/wise/sns-dashboard/scripts/grant_sns_access.mjs`;

  const summary = `申請者: ${name}（${email}）がSNSダッシュボードの閲覧権限を申請しています。`
    + `承認するとFirestoreのusers/${email}にsnsAccess=trueが付与されます。拒否するとaccess_requestsがrejectedになります。`;

  const instruction = `node ${grantScript} --email ${email} --action {answer}`;

  try {
    // execFileSync: emailやnameをシェルメタキャラとして解釈させないため引数配列で渡す
    const out = execFileSync('node', [
      'C:/Users/WISE-Yamauchi/wise/common/add_confirmation.mjs',
      '--source', 'sns-access-request',
      '--title', `SNSダッシュボード閲覧申請: ${name}`,
      '--summary', summary,
      '--options', '承認|拒否',
      '--dedupe-key', dedupeKey,
      '--urgency', 'urgent',
      '--instruction', instruction,
    ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(out.trim());
    if (!out.includes('DUPLICATE')) queued++;
  } catch (e) {
    console.error(`❌ ${email} のキュー登録失敗:`, e.stderr || e.message);
  }
}

console.log(`[watch_access_requests] pending=${snap.size} / 新規キュー=${queued}件`);
process.exit(0);
