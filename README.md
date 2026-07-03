# ファーマシストキャンパス SNSダッシュボード（sns-dashboard）

## 概要
ファーマシストキャンパスの各SNSチャンネル（YouTube・エルメ/公式LINE・X・Facebook）から
登録者数・インプレッション・提供コンテンツを収集し、進捗確認と分析を行うダッシュボード。

## 公開URL
https://wiseinc-pharmacy.github.io/sns-dashboard/

## アーキテクチャ

```
コレクター                              スナップショットDB          ダッシュボード
├ YouTube Data API（OAuth・自動）  →  data/snapshots.json  →  index.html
└ エルメMCP（セッション内・週1）        data/contents.json       (GitHub Pages)
   → save_lme_snapshot.mjs で記録
```

- **DB = リポジトリ内JSON**（Firestore不使用・メンテ最小方針）
- **集計値のみ保存**。個人データ（友だち名・メールアドレス等）は保存しない
- スナップショットは日付キーで洗い替え（同日再実行は上書き）

## データ収集

### YouTube（自動化可）
```
node scripts/collect_youtube.mjs
```
- チャンネル統計（登録者数・総再生数・動画数）→ snapshots.json
- 全動画一覧（タイトル・公開日・再生数・高評価）→ contents.json
- 認証: pharmacist-reskilling-members の OAuth token を流用（.env参照）
- インプレッションは YouTube Analytics API が必要（スコープ追加の再認証後に対応予定）

### エルメ（セッション内・週1月曜ルーティン）
エルメMCPはログイン認証型のため無人実行不可。Claude Codeセッション内でMCPから取得し、
ワンコマンドで記録する:
```
node scripts/save_lme_snapshot.mjs --friends <友だち数> [--added <期間増加>] [--blocked <ブロック数>]
node scripts/save_lme_snapshot.mjs --broadcasts-json <配信一覧JSONファイル>
```

### X / Facebook（未連携・後日追加）
- X: 無料枠廃止のため従量課金（Owned Reads）の設定後に実装（最終段階で実装と決定 2026-07-03）
- Facebook: Graph APIページインサイトのメトリクス改廃が落ち着いてから検討

## ファイル構成
- `index.html` — ダッシュボード本体（推移グラフ・チャンネルカード・コンテンツ一覧）
- `data/snapshots.json` — 日次スナップショット（チャンネル別時系列）
- `data/contents.json` — 提供コンテンツ一覧（YouTube動画・エルメ配信）
- `scripts/collect_youtube.mjs` — YouTube収集
- `scripts/save_lme_snapshot.mjs` — エルメ記録用CLI
- `run_daily_collect.ps1` — 日次実行（収集→commit→push）タスクスケジューラ登録用

## 更新履歴
- 2026-07-03 初版作成（YouTube+エルメ先行。X/Facebookは後日）
