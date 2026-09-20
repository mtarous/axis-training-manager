# AXIS 端末間自動同期 — Google Apps Script セットアップ

更新: 2026-09-20 13:41 JST

## 前提
- 同期先は個人Google Driveの非公開スプレッドシート `AXIS_SYNC_PRIVATE`。
- 顧客情報はGoogle Sheetsへ平文保存しない。
- 公開GitHubへスプレッドシートID、WebアプリURL、同期トークン、実顧客情報を書かない。
- AXIS側の自動同期は初期状態OFF。

## 最小セットアップ
1. Google Sheetsで `AXIS_SYNC_PRIVATE` を開く。
2. **拡張機能 → Apps Script** を開く。
3. この実装と同時に配布する `AXIS_SYNC_PRIVATE.gs` の全内容を貼り付けて保存する。\n   - 確認用 SHA-256: `bba574184fbeed09ba1eee89b1ea4ffb0f65bb8d6498dd4ca6fa6c66fa955dab`
4. `axisSetup` を1回だけ実行して権限を許可し、表示された同期トークンをコピーする。
5. **デプロイ → 新しいデプロイ → ウェブアプリ**。
   - 次のユーザーとして実行: 自分
   - アクセスできるユーザー: 全員
6. デプロイ後の `/exec` URLをコピーする。
7. AXIS TRAININGで **その他 → 端末間の自動同期 → 同期先設定** を開き、URLとトークンを入力する。
8. **設定を保存・接続確認** 後に自動同期をONにする。

## 保存方式
- ブラウザでAXISアクセスコードからPBKDF2-SHA-256により同期専用鍵を派生。
- スナップショットごとにランダムsalt / IVを生成。
- AES-GCMで暗号化してから送信。
- Apps Scriptは暗号文をappend-only保存。
- Google Sheetsの1セル上限を避けるため、暗号文は40,000文字単位で複数行へ分割する。
- pull → merge → push で統合する。

## 競合ルール
- sessions: 重複シグネチャでunion。
- clients: `updatedAt` / `createdAt` が新しい方。aliasesはunion。
- historyEdits: keyごとに `updatedAt` が新しい方。取消はtombstoneで同期。
- hiddenSchedule: hidden / visible状態と `updatedAt` を同期。
- draft: 自動同期対象外。各端末の入力途中を優先する。

## セキュリティ
- WebアプリURLと同期トークンは端末localStorageにのみ保存。
- Apps Script側では同期トークンのSHA-256のみScript Propertiesへ保存。
- 実顧客データをテストに使わない。


## 既存シートとの互換性
- `sync_state`: 8列の既存ヘッダーを検証し、既存の `primary` bootstrap行は削除しない。
- `audit_log`: 8列の既存ヘッダーを維持。
- `config` は既存の `key / value / description / updated_at` 4列を維持。
- 既存の `schema_version=1` / `storage_mode=encrypted_blob` / `owner_scope=personal_drive` を保持する。
