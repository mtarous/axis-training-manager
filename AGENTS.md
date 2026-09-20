# AGENTS.md — このフォルダで作業するエージェントへ

## 最初に読むもの

`/Users/sugishimamaho/クロード/docs/handoff/2026-09-20_0800_引継ぎ_3アプリ保守とAXIS_v16デザイン刷新.md`

このリポジトリは AXIS TRAINING。3アプリ（つなぐアプリ / AXIS TRAINING / 日報V3）の現状・決定事項・未完了・全パス・ハマり所が
このファイル1つに入っている。作業前に必ず全文読むこと。

## 環境

- macOS (Darwin 21.6.0)。引き継ぎ書に出てくる `C:\Users\...` は別PCのパスで、ここには存在しない
- Node は PATH に無い。毎回 `export PATH=$HOME/.local/node/bin:$PATH`
- `gh` は GitHub アカウント mtarous で認証済み
- `clasp` 3.4.1 導入済み。`tunagu.fukuoka@gmail.com` でログイン済み（資格情報は `~/.clasprc.json`）

## 3つのプロジェクト

| 名前 | 種別 | 場所 |
|---|---|---|
| AXIS TRAINING | PWA / GitHub Pages | `/Users/sugishimamaho/クロード/axis-training-manager` |
| つなぐアプリ | Google Apps Script | scriptId `1RY4rMoIr82MO3mGZ5KiPbdtUMaaDxH3qU_-DJ4nfu5i8WS8zXjuMEqEp` |
| 日報V3 | Google Apps Script | scriptId `1utEPPp71Ty_df-1tDMWPDv1ZKdpTG9hLcnKrpd0CcYiy-s13fGBb3H5S` |

## 作業の原則

1. 本番を壊さない。1回の変更範囲を小さく。原因が明確な不具合だけ直す
2. 確認していないことを「正常」「修正済み」と報告しない。実画面かDOM実測で裏を取る
3. 古いバージョンのコードで本番を上書きしない。Version は必ず実測する
4. Apps Script を触る前に、必ず現行ソースを取得してバックアップする
5. 秘密情報（APIキー・トークン・パスワード）をリポジトリやプロンプトに書かない

詳細な禁止事項は引き継ぎ書の末尾「絶対に守ること」を参照。
