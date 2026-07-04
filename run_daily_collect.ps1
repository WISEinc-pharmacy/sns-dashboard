# SNSダッシュボード日次収集（タスクスケジューラ登録用）
# YouTube収集 → Firestore（sns_data）反映。データはFirestoreが正・repoにはコミットしない
# 失敗・タイムアウト時は run_with_guard.mjs 経由で麗華DM（urgency=normal・朝まとめ）
$ErrorActionPreference = 'Stop'
$repo   = 'C:\Users\WISE-Yamauchi\wise\sns-dashboard'
$guard  = 'C:\Users\WISE-Yamauchi\wise\common\run_with_guard.mjs'
$log    = Join-Path $repo 'collect.log'
$timeout = 300  # 5分（通常は30秒以内で完了する）

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $log -Value "[$stamp] start" -Encoding utf8

node $guard --script scripts/collect_youtube.mjs --timeout $timeout --source SNS_collect --cwd $repo >> $log 2>&1
if ($LASTEXITCODE -ne 0) {
    Add-Content -Path $log -Value "[$stamp] collect_youtube failed (exit $LASTEXITCODE)" -Encoding utf8
    exit 1
}

node $guard --script scripts/push_to_firestore.mjs --timeout $timeout --source SNS_collect --cwd $repo >> $log 2>&1
if ($LASTEXITCODE -ne 0) {
    Add-Content -Path $log -Value "[$stamp] push_to_firestore failed (exit $LASTEXITCODE)" -Encoding utf8
    exit 1
}

$stamp2 = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $log -Value "[$stamp2] done" -Encoding utf8
