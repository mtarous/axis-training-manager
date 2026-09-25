# AXIS 端末間自動同期 — Google Apps Script セットアップ

更新: 2026-09-21 08:04 JST

## 前提
- 同期先は個人Google Driveの非公開スプレッドシート `AXIS_SYNC_PRIVATE`。
- 顧客情報はGoogle Driveへ平文保存しない。
- 公開GitHubへスプレッドシートID、WebアプリURL、同期トークン、実顧客情報を書かない。
- AXIS側の自動同期は初期状態OFF。
- AXIS本体の同期クライアントは `v16-sync.js`。

## 最小セットアップ
1. 個人Google Driveで `AXIS_SYNC_PRIVATE` を開く。
2. **拡張機能 → Apps Script** を開く。
3. Apps Scriptの `Code.gs` を全削除し、このリポジトリの `AXIS_SYNC_PRIVATE.gs` を貼り付けて保存する。
4. 関数 `axisSetup` を1回実行し、Googleの権限確認を許可する。
5. 実行ログに表示された `AXIS_SYNC_TOKEN=...` の値を控える。
   - トークンを紛失した場合は `axisRotateToken` を実行して再発行する。
6. **デプロイ → 新しいデプロイ → ウェブアプリ**。
   - 次のユーザーとして実行: 自分
   - アクセスできるユーザー: 全員
7. デプロイ後の `/exec` URLをコピーする。
8. デプロイ後にもう一度 `axisSetup` を実行すると、非公開 `config` シートの `web_app_url` も更新される。
9. AXIS TRAININGで **その他 → 端末間の自動同期 → 同期先設定** を開く。
10. WebアプリURLと同期トークンを入力し、**設定を保存・接続確認**。
11. 接続確認後に **今すぐ同期**。
12. 正常確認後に **自動同期** をONにする。

## Googleカレンダーを直接読み込む（op=calendar）

`AXIS_SYNC_PRIVATE.gs` に `op=calendar` を追加済み。これを有効にすると、AXIS側は
リポジトリ同梱の `calendar-current.enc` ではなく、Googleカレンダーを直接読む。

### 反映手順（1回だけ必要）
1. スプレッドシート `AXIS_SYNC_PRIVATE` → **拡張機能 → Apps Script** を開く。
2. `Code.gs` を、このリポジトリの最新 `AXIS_SYNC_PRIVATE.gs` で全置換して保存する。
3. 関数 `calendar_` はカレンダー読み取り権限を使うため、**デプロイ → デプロイを管理 →
   既存のウェブアプリを編集 → 新バージョン** で再デプロイする。
4. 再デプロイ後、初回アクセス時にGoogleのカレンダー権限確認が出るので許可する。
   （URLは変わらないので、AXIS側の設定はそのままでよい）

### 動作
- AXISのロック解除時に自動で取得し、10分以内に取得済みならスキップする。
- スケジュール画面の「カレンダーを更新」ボタンでいつでも再取得できる。
- 取得結果は端末内 `axis_calendar_live_v1` にキャッシュし、次回起動時は即表示してから裏で更新する。
- どの予定をAXISに取り込むかの判定は従来どおりクライアント側で行う。
  スクリプトは予定をそのまま返すだけで、利用者名などの判定条件を持たない。
- 同期先URL・トークン未設定の場合は何もせず、同梱スナップショットのまま動く。

### 取り込み条件（クライアント側・従来どおり）
- 既存AXIS利用者名に一致 → 取り込み
- 予定名に「パーソナル」「パーソナル体験」「トレーニング」「トレーニング体験」 → 取り込み
- 「○○さん 体験」だけ → 除外（就労支援「つなぐ」の体験予定が混ざるため）

## 保存方式
- ブラウザでAXISアクセスコードからPBKDF2-SHA-256により同期専用鍵を派生。
- スナップショットごとにランダムsalt / IVを生成。
- AES-GCMで暗号化してから送信。
- Apps Scriptは暗号文を復号しない。
- 暗号化snapshotは個人Driveの非公開フォルダ `AXIS_SYNC_PRIVATE_BLOBS` に保存。
- `sync_state` シートにはsnapshotの参照ID・revision・checksum等のメタ情報だけを保存。
- pull → merge → push で統合する。
- 最大40snapshotを保持し、古い暗号化blobは自動でゴミ箱へ移す。

## sync_state
列:
- snapshot_id
- payload_ref
- updated_at
- revision
- device_id
- checksum
- schema_version
- size_bytes

## audit_log
列:
- timestamp
- device_id
- action
- revision
- checksum
- status
- note
- schema_version

## 競合ルール
- sessions: 重複シグネチャでunion。
- clients: `updatedAt` / `createdAt` が新しい方。aliasesはunion。
- historyEdits: keyごとに `updatedAt` が新しい方。
  - 「元に戻す」は `restored:true + updatedAt` をtombstoneとして同期。
- hiddenSchedule: hidden / visible状態と `updatedAt` を同期。
- draft: 自動同期対象外。各端末の入力途中を優先する。

## セキュリティ
- WebアプリURLと同期トークンは端末localStorageにのみ保存。
- Apps Script側では同期トークンの**SHA-256ハッシュのみ**Script Propertiesへ保存。
- `sync_token` の平文はGoogle Sheetへ保存しない。
- 暗号化blob内にも平文の顧客情報は保存しない。
- 実顧客データをテストに使わない。
- WebアプリURLや同期トークンを公開GitHubへコミットしない。

## API
### health
GET JSONP:
`?op=health&token=...&callback=...`

### pull
GET JSONP:
`?op=pull&token=...&callback=...`

### push
POST form:
- op=push
- token
- device_id
- payload_ciphertext
- iv_b64
- checksum
- schema_version

ブラウザ側はPOST後、pullでchecksumを再確認して保存完了を判定する。

## 既存データの扱い
- `data.enc` を変更しない。
- `calendar.enc` を変更しない。
- raw BASEを変更しない。
- Google Calendar予定を削除しない。
- 退会者の履歴を削除しない。
- 自動同期ON前に完全JSONバックアップを1回取っておくことを推奨する。
