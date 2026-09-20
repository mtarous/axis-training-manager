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
