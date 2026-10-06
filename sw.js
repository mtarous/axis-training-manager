/* AXIS オフライン対応。
   まずネットワーク、ダメならキャッシュ。オンラインなら必ず最新が出る。
   いまの本体（next/ の中身）と、以前のアプリ（legacy.html）の両方をまかなう。 */

const CACHE = "axis-root-003";

/* いまの本体 */
const APP = [
  "./",
  "index.html",
  "manifest.json",
  "xlsx.full.min.js",
  "data.enc",
  "calendar.enc",
  "calendar-current.enc",
  "icon-192.png",
  "icon-512.png",
  "next/app.js",
  "next/core/crypto.js",
  "next/core/meta.js",
  "next/core/migrate.js",
  "next/core/model.js",
  "next/core/muscles.js",
  "next/core/schedule.js",
  "next/core/stats.js",
  "next/core/store.js",
  "next/ui/dom.js",
  "next/ui/rest-timer.js",
  "next/screens/clients.js",
  "next/screens/history.js",
  "next/screens/home.js",
  "next/screens/report.js",
  "next/screens/schedule.js",
  "next/screens/settings.js",
  "next/screens/train.js",
  "next/features/calendar.js",
  "next/features/excel.js",
  "next/styles/tokens.css",
  "next/styles/app.css",
  "next/styles/home.css",
  "next/styles/clients.css",
  "next/styles/report.css",
  "next/styles/schedule.css",
  "next/styles/settings.css",
  "next/styles/train.css",
  "next/styles/history.css"
];

/* 以前のアプリ。legacy.html から今まで通り開ける */
const LEGACY = [
  "legacy.html",
  "v5.js",
  "v6.js",
  "v7-summary-muscle.js",
  "v9-smart-rest.js",
  "v10-ui.js",
  "v13-refine.js",
  "v14-ux.js",
  "v16-design.js",
  "v16-train.js",
  "v16-guide.js",
  "v16-history-edit.js",
  "v16-pages.js",
  "v16-anatomy.js",
  "v16-report-client-admin.js",
  "v16-client-portability.js",
  "v16-sync.js",
  "v17-input.js",
  "v18-excel-submit.js",
  "v19-calendar-live.js",
  "v20-bulk-import.js",
  "v22-setup-link.js",
  "v24-menu-group.js",
  "v25-rest-weight.js",
  "v26-delete-session.js",
  "theme-v7.css",
  "theme-v10.css",
  "theme-v13.css",
  "theme-v14.css",
  "theme-v16.css",
  "theme-v16-train.css",
  "theme-v16-guide.css",
  "theme-v16-history-edit.css",
  "theme-v16-pages.css",
  "theme-v16-anatomy.css",
  "theme-v16-report-client-admin.css",
  "theme-v16-client-portability.css",
  "theme-v16-sync.css",
  "theme-v17-input.css",
  "theme-v20-bulk.css",
  "theme-v25.css",
  "theme-v26.css"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      /* 1つでも落ちると全部入らないので、1件ずつ入れて失敗は見逃す */
      .then(c => Promise.all([...APP, ...LEGACY].map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        /* ?v=1 のような版の違いは無視して拾う */
        const hit = await caches.match(e.request, { ignoreSearch: true });
        if(hit) return hit;
        /* 画面そのものの読み込みだけ、最後にアプリの入口を返す。
           JSやCSSにHTMLを返すと、かえって壊れる。 */
        if(e.request.mode === "navigate"){
          const shell = await caches.match("index.html", { ignoreSearch: true });
          if(shell) return shell;
        }
        return Response.error();
      })
  );
});
