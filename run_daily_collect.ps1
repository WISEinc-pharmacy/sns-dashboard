# SNSダッシュボード日次収集（タスクスケジューラ登録用）
# YouTube収集 → data/ に差分があればcommit+push
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

cmd /c "git add data/ >> `"$log`" 2>&1"
cmd /c "git diff --cached --quiet"
if ($LASTEXITCODE -ne 0) {
    $day = Get-Date -Format 'yyyy-MM-dd'
    cmd /c "git commit -m `"chore: daily snapshot $day`" >> `"$log`" 2>&1"
    cmd /c "git push origin main >> `"$log`" 2>&1"
    Add-Content -Path $log -Value "[$stamp] pushed" -Encoding utf8
} else {
    Add-Content -Path $log -Value "[$stamp] no changes" -Encoding utf8
}
