# Regression tests

## current-main-training.cjs

現行 main のトレ中画面を対象にした安全なスモークテストです。

- DUMMY_TEST の合成データだけを使用
- data.enc / calendar.enc の復号を行わない
- Service Worker を block するため PWA 更新・オフライン検証には使わない
- 重量変更、セット記録、休憩開始、draft、375/390/430/900px の横 overflow、pageerror を確認

実行例:

    python -m http.server 8000
    node tests/current-main-training.cjs

前提: Node.js と Playwright がローカルに導入済みであること。

未検証のまま残す項目:
- 本番アクセスコードによる実データ復号
- iPhone Safari 実機
- ホーム画面追加済み PWA の更新/オフライン
- AXIS_SYNC_PRIVATE の2端末E2E
