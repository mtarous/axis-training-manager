# AXIS 同期・顧客管理メモ

更新: 2026-09-20 13:24 JST

## 現在の永続化
- `axis_training_added`: 端末入力セッション
- `axis_training_draft`: 入力途中
- `axis_client_registry_v1`: 顧客台帳overlay
- `axis_training_edits_v1`: 過去記録編集overlay
- `axis_hidden_schedule_v1`: AXIS上だけ非表示にした予定
- `axis_training_key`: 「このiPhoneでコードを記憶」時のみ保存

## 顧客管理
- 顧客IDは `AX-...`。
- 既存顧客には旧名から決定的IDを算出。
- 新規顧客には新規IDを発行。
- 表示名変更は `aliases` で旧名と接続。
- raw `BASE` / `added` を名前変更時に書き換えない。
- 退会は `active:false`。履歴削除ではない。

## 完全バックアップ
形式: `AXIS_TRAINING_BACKUP` version 2

含む:
- sessions
- clients
- historyEdits
- hiddenSchedule
- draft
- exported

復元:
- sessionsは重複シグネチャで統合
- clientsは `updatedAt` / `createdAt` の新しい方
- historyEditsは現状JSON merge
- hiddenScheduleはunion
- draftはローカルに無い場合のみ復元

## 自動同期方針
保存先:
- 個人Google Driveの非公開スプレッドシート `AXIS_SYNC_PRIVATE`

作成済みタブ:
- `sync_state`
- `audit_log`
- `config`

`sync_state` の列:
- slot
- payload_ciphertext
- iv_b64
- updated_at
- revision
- device_id
- checksum
- schema_version

`audit_log` の列:
- timestamp
- device_id
- action
- revision
- checksum
- status
- note
- schema_version

`config`:
- schema_version = 1
- storage_mode = encrypted_blob
- owner_scope = personal_drive

## セキュリティ
- Google Sheetへ平文の顧客データを保存しない。
- ブラウザ側でAES-GCM暗号化してから送る。
- 公開リポジトリへ以下を入れない。
  - Google Sheet ID
  - Apps Script WebアプリURL
  - API秘密
  - 実顧客名
- 同期用鍵はAXISアクセスコードからPBKDF2で別salt/AADを使って派生する。

## 競合設計
推奨: append-only encrypted snapshot + pull/merge/push。

統合:
- sessions: union
- clients: updatedAtが新しい方
- historyEdits: 各key単位でupdatedAt比較
- hiddenSchedule: 現状unionだけでは「戻す」を同期できないため要改善
- draft: ローカル優先

## 未解決
- Apps Script Webアプリの作成・デプロイ。
- history edit の復元操作にtombstoneがない。
- schedule hide の復元操作にtombstoneがない。
- 自動同期ON/OFF、最終同期時刻、同期エラー表示のUI。
- オフライン時のretry queue。
- 端末A/B同時更新テスト。

## テスト上の注意
- Service Workerの古いcacheが新JSを隠すことがある。
- ローカルコード確認はSWを無効化した新規ブラウザcontextが安全。
- 本番確認はSW有効で行う。
- 375px / 390px / 430pxで横スクロールを確認する。


## 2026-09-20 13:41 JST 自動同期クライアント実装
作業ブランチ: `axis-sync-20260920-1341`

### AXIS側
- `v16-sync.js` を追加。
- `theme-v16-sync.css` を追加。
- 自動同期は初期状態OFF。
- Apps Script WebアプリURLと同期トークンは端末localStorageだけに保存し、公開GitHubへ直書きしない。
- AXIS unlock中のアクセスコードをメモリ上で同期鍵派生へ渡すため、`index.html` に `axisSetUnlockedPassphrase()` / `axisAfterUnlock()` フックを追加。
- 同期用PBKDF2は SHA-256 / 210,000 iterations。
- 同期スナップショットごとにランダムsalt・IVを生成し、AES-GCMで暗号化。
- 同期専用AADは `AXIS_SYNC_PRIVATE|snapshot|v1`。
- pull → merge → push。
- remoteはappend-only encrypted snapshot前提。
- `draft` は自動同期対象外。入力途中は各端末ローカル優先。
- Service Worker cache名を `axis-training-v16-sync1` へ更新。

### merge
- sessions: 重複シグネチャunion。
- clients: `updatedAt` / `createdAt` の新しい方。aliasesはunion。
- historyEdits: key単位で `updatedAt` 比較。
- history edit「元に戻す」はentry削除ではなく `{restored:true, updatedAt}` tombstoneへ変更。
- hiddenSchedule: `axis_hidden_schedule_state_v2` に `{hidden, updatedAt}` を保持し、legacyの `axis_hidden_schedule_v1` 配列へ反映。
- 予定の「戻す」「すべて戻す」もvisible tombstoneとして同期可能。
- セッション配列順は実データでは維持する。同期差分比較用hashだけ集合として正規化し、端末ごとの配列順差で無限pushしない。
- 新規保存セッションには `savedAt` を付与する。
- 新規アプリ入力の履歴編集キーは `["app-v2", savedAt, exerciseIndex]` を使用し、端末ごとのsessions配列順に依存させない。
- 既存のsavedAtなし履歴は従来キーを維持し、既存編集を壊さない。

### UI検証
ダミーデータのみの独立ブラウザ環境で同期カードを実測。
- 375px: scrollWidth 375 / clientWidth 375 → PASS
- 390px: scrollWidth 390 / clientWidth 390 → PASS
- 430px: scrollWidth 430 / clientWidth 430 → PASS

### 個人Drive確認
- 個人Drive上に非公開 `AXIS_SYNC_PRIVATE` が存在することを確認。
- `sync_state` / `audit_log` / `config` の既存構造を確認。
- `sync_state` と `audit_log` は引継書どおり8列。
- `config` は `key / value / description / updated_at` の4列。
- 実ファイルID・URLは公開GitHubへ記録しない。

### Apps Script
- ブラウザから暗号化済みpayloadだけ受け取るbound Apps Scriptを作成済み。
- 既存のbootstrap行を保持し、`snapshot:<revision>:<part>/<count>` をappend-onlyで追加する。
- Google Sheets 1セル上限対策としてpayloadを40,000文字単位に分割する。
- Script Propertiesにはprivate spreadsheet IDと同期トークンのSHA-256だけを保持する。
- Apps Script作成・Webアプリデプロイはユーザー操作が必要。
- WebアプリURL取得後にAXISの「その他 → 端末間の自動同期 → 同期先設定」へ端末ごとに登録する。

### テスト済みのmergeケース
実顧客データは使わずダミーデータのみ。
- 端末A/Bのsessions union
- 顧客退会
- 再開
- 名前変更後のaliases保持
- 履歴編集
- 履歴編集の取消tombstone
- 取消後の再編集
- 予定非表示
- 予定非表示解除
- sessions順序差だけでは同期差分扱いしない

### 未完
- Apps Script Webアプリの実デプロイ。
- WebアプリURL・同期トークンをAXIS端末へ設定。
- 実APIを介した端末A/B E2E。
- 本番main反映後のGitHub Pages確認。
