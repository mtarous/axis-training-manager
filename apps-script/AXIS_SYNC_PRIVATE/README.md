# AXIS_SYNC_PRIVATE Apps Script

更新: 2026-09-21 08:04 JST

AXIS TRAINING の端末間同期用Web APIです。
このフォルダの `Code.gs` を、個人Google Driveの非公開スプレッドシート `AXIS_SYNC_PRIVATE` に紐づけて使用します。

## 初回設定

1. 個人Google Driveで `AXIS_SYNC_PRIVATE` を開く。
2. 「拡張機能」→「Apps Script」を開く。
3. 既存の `Code.gs` を全削除し、このリポジトリの `apps-script/AXIS_SYNC_PRIVATE/Code.gs` を貼り付けて保存する。
4. 関数 `setupAxisSync` を1回実行し、Googleの権限確認を許可する。
5. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」。
   - 実行するユーザー: 自分
   - アクセスできるユーザー: 全員
6. デプロイ後、もう一度 `setupAxisSync` を実行する。
7. `AXIS_SYNC_PRIVATE` の `config` シートで以下を確認する。
   - `web_app_url`
   - `sync_token`
8. AXIS TRAINING → その他 → 端末間自動同期 に上記2つを入力。
9. 「設定を保存」→「接続テスト」→「今すぐ同期」。
10. 正常確認後に「自動同期」をONにする。

## セキュリティ

- `web_app_url` と `sync_token` は公開GitHubへ書かない。
- 顧客・トレーニングデータはブラウザ側でAES-GCM暗号化してから送信する。
- Apps Script側には暗号化済みsnapshotのみ保存する。
- Web APIは `sync_token` が一致しないアクセスを拒否する。
- `sync_token` は個人Driveの非公開 `config` シートにだけ保存する。

## 保存先

Apps Scriptは `AXIS_SYNC_PRIVATE` と同じDrive階層に
`AXIS_SYNC_PRIVATE_BLOBS`
フォルダを作成し、暗号化snapshotを保存します。

`sync_state`:
- snapshot_id
- payload_ref
- updated_at
- revision
- device_id
- checksum
- schema_version
- size_bytes

`audit_log`:
- timestamp
- device_id
- action
- revision
- checksum
- status
- note
- schema_version

## 同期方式

1. pull
2. ローカルとremote snapshotをmerge
3. 同期状態をAES-GCM暗号化
4. push
5. pullで保存確認

同じchecksumは重複保存しません。

競合:
- sessions: union
- clients: updatedAt優先
- history edits: updatedAt + restore tombstone
- hidden schedule: hidden/unhidden state + updatedAt
- draft: 自動同期対象外

## 注意

Apps Script WebアプリURLや同期キーはコードへ直書きしません。
AXIS側の端末設定（localStorage）に保存されます。

同期設定が未入力、または自動同期OFFの場合、AXISは同期サーバーへ通信しません。
