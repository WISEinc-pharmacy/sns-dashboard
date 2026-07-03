# SNSダッシュボード日次収集（タスクスケジューラ登録用）
# YouTube収集 → data/ に差分があればcommit+push
$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\WISE-Yamauchi\wise\sns-dashboard'
$log = Join-Path $repo 'collect.log'
Set-Location $repo

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $log -Value "[$stamp] start" -Encoding utf8

node scripts/collect_youtube.mjs *>> $log
if ($LASTEXITCODE -ne 0) {
    Add-Content -Path $log -Value "[$stamp] collect_youtube failed (exit $LASTEXITCODE)" -Encoding utf8
    exit 1
}

git add data/
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "chore: daily snapshot $(Get-Date -Format 'yyyy-MM-dd')" *>> $log
    git push origin main *>> $log
    Add-Content -Path $log -Value "[$stamp] pushed" -Encoding utf8
} else {
    Add-Content -Path $log -Value "[$stamp] no changes" -Encoding utf8
}
