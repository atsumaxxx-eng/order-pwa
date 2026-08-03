# 注文PWA — 公開とデプロイ手順

`docs/` = 客の注文用PWA(オフライン対応・インストール可)。GitHub Pagesで配信し、バックエンドは既存GASを**JSON API**として利用します。既存のGAS版(`?page=index`)はそのまま残るので、並行運用できます。

## 構成

```
docs/
  index.html   … 注文アプリ本体（アプリシェル）
  app.js       … UI・カート・送信・オフライン再送
  api.js       … GAS API呼び出し + IndexedDB送信キュー
  config.js    … GASのexec URL（ここだけ差し替え可）
  sw.js        … Service Worker（オフライン起動）
  manifest.webmanifest / icons/  … インストール用
  styles.css
```

GAS側は `code.js` の `doPost` に `?api=1` のJSON APIを追加済み(既存の `google.script.run` は温存)。

## ① 初回だけ: 公開リポジトリ order-pwa でPagesを有効化

`Development` は非公開のため、フロント(`docs/`)だけを**公開リポジトリ `izakanpai/order-pwa`** にミラーして配信する。
`deploy.bat` が `docs/` を order-pwa のルートへ subtree push する。

1. 先に一度 `deploy.bat` を実行して order-pwa に push（`main` ブランチが作られる）
2. GitHub → `izakanpai/order-pwa` → **Settings → Pages**
3. Source: **Deploy from a branch** / Branch: **main** / Folder: **/(root)** → **Save**
4. 数分後、公開URL: `https://izakanpai.com/yuwaku/`

## ② デプロイ（毎回）

`ManagementSystemDev\deploy.bat` をダブルクリック(または「ファイル名を指定して実行」)。
これで **git add+commit+push(docs含む) → clasp push → clasp deploy(URL固定)** まで自動実行。
GitHub PagesとGASの両方が更新されます。ログは `deploy.log`。

## ③ QRコードのURL

新PWAの注文URLは卓番号つき:
```
https://izakanpai.com/yuwaku/?table=1
https://izakanpai.com/yuwaku/?table=2 …
```
各卓のQRをこのURLで作り直すと、客はPWAで注文できます(旧GAS版QRも当面併用可)。

## ④ 動作確認チェックリスト

- [ ] スマホでURLを開く → メニュー表示・カテゴリ切替・数量増減・合計(税/サービス料込)
- [ ] 「注文する」→ 送信成功 → 注文管理(GAS admin)に反映・キッチン印刷
- [ ] iPhone: Safari共有→「ホーム画面に追加」/ Android: Chrome「アプリをインストール」でインストール可能
- [ ] **オフライン試験**: 機内モードで開く→(SWによりアプリ起動)→注文→「保留しました(オフライン)」→通信復帰で自動送信、保留バッジが消える

## 既知の制約・次の一手

- 現状はまず**客の注文フロー**を移行。管理系(注文管理/在庫/勤怠/プリンタ)は当面GAS版のまま。順次PWAのAPI経由へ移せます。
- 二重送信の完全防止(clientIdサーバ側デデュープ)は未実装 → 必要なら追加。
- CORS: GASはtext/plainのPOSTでプリフライト回避済み。うまく通らない場合は連絡を。
