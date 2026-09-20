# AGENTS.md — AXIS TRAINING

パーソナルトレーニング記録用の PWA。GitHub Pages で公開。
本番: https://mtarous.github.io/axis-training-manager/

## 構成

単一の `index.html` にデータ層と中核処理があり、その上に `v5` → `v6` → `v7` → `v9` →
`v10` → `v13` → `v14` → `v16` の順でスクリプトを読み込み、後から読むファイルが
`window.xxx` を上書きしていく積層方式。テーマ CSS も同じ順で重ねる。

| ファイル | 役割 |
|---|---|
| `index.html` | データ層（`BASE` / `added` / `all()` / `sessions()`）・`renderInput`・`save()` |
| `data.enc` | 過去記録（PBKDF2 + AES-GCM）。**再生成禁止** |
| `calendar.enc` | Google カレンダー同期データ |
| `sw.js` | Service Worker。変更時はキャッシュ名を必ず上げる |
| `v7-summary-muscle.js` | `musclesForExercise` / 共有レポート |
| `v9-smart-rest.js` | スマート休憩の秒数算出 / 40分セッション |
| `v10-ui.js` | 旧デザイン層 |
| `v13-refine.js` | 暦週集計・スパークライン・分析画面 |
| `v14-ux.js` | 人体図（旧）・スケジュール復元 |
| `v16-design.js` / `theme-v16.css` | 現行デザイン層（ホーム・人体図・グラフ・ナビ） |

## 作業の原則

1. 本番を壊さない。1回の変更範囲を小さく。原因が明確な不具合だけ直す
2. 確認していないことを「正常」「修正済み」と報告しない。実画面か DOM 実測で裏を取る
3. `data.enc` / `calendar.enc` を再生成しない。既存の記録を消さない
4. 旧 UI に戻さない。Excel 出力の仕様を削らない
5. 「今週の総ボリューム」は月曜〜日曜の暦週。直近7トレーニング日に戻さない
6. 予定の非表示は `axis_hidden_schedule_v1`。Google Calendar 本体の予定は削除しない
7. 個人情報（利用者名・写真・メールアドレス）をこのリポジトリに入れない。**公開リポジトリです**

## 変更したら

```
node --check <変更したJS>
git add -A && git commit && git pull --rebase && git push
gh api repos/mtarous/axis-training-manager/pages/builds/latest   # status が built になるまで
```

そのうえで本番 URL を実際に開いて画面を確認する。ここまでやって初めて「完了」。

## 詳細な引き継ぎ

作業端末のローカルに引継書がある。Codex など端末上で動くエージェントは
`docs/handoff/` 配下の最新の引継書を読むこと（このリポジトリには含めない）。
