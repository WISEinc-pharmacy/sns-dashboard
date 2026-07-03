# SNSダッシュボード日次収集（タスクスケジューラ登録用）
# YouTube収集 → Firestore（sns_data）反映。データはFirestoreが正・repoにはコミットしない
$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\WISE-Yamauchi\wise\sns-dashboard'
$log = Join-Path $repo 'collect.log'
Set-Location $repo

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $log -Value "[$stamp] start" -Encoding utf8

cmd /c "node scripts/collect_youtube.mjs >> `"$log`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Add-Content -Path $log -Value "[$stamp] collect_youtube failed (exit $LASTEXITCODE)" -Encoding utf8
    exit 1
}

cmd /c "node scripts/push_to_firestore.mjs >> `"$log`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Add-Content -Path $log -Value "[$stamp] push_to_firestore failed (exit $LASTEXITCODE)" -Encoding utf8
    exit 1
}

Add-Content -Path $log -Value "[$stamp] done" -Encoding utf8
