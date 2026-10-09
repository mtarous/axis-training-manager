/* AXIS オフライン対応。
   まずネットワーク、ダメならキャッシュ。オンラインなら必ず最新が出る。
   いまの本体（next/ の中身）と、以前のアプリ（legacy.html）の両方をまかなう。 */

const CACHE = "axis-root-028";

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
  "next/app.js?v=14",
  "next/app.js?v=15",
  "next/app.js?v=16",
  "next/app.js?v=17",
  "next/app.js?v=18",
  "next/app.js?v=19",
  "next/app.js?v=20",
  "next/app.js?v=21",
  "next/app.js?v=22",
  "next/app.js?v=23",
  "next/app.js?v=24",
  "next/core/archive.js",
  "next/core/archive.js?v=15",
  "next/core/crypto.js",
  "next/core/meta.js",
  "next/core/migrate.js",
  "next/core/migrate.js?v=15",
  "next/core/legacy-notes.js",
  "next/core/legacy-notes.js?v=1",
  "next/core/model.js",
  "next/core/model.js?v=14",
  "next/core/muscles.js",
  "next/core/schedule.js",
  "next/core/schedule.js?v=15",
  "next/core/stats.js",
  "next/core/store.js",
  "next/core/store.js?v=15",
  "next/ui/dom.js",
  "next/ui/rest-timer.js",
  "next/ui/muscle-map.js",
  "next/ui/muscle-map.js?v=1",
  "next/screens/clients.js",
  "next/screens/clients.js?v=16",
  "next/screens/clients.js?v=17",
  "next/screens/clients.js?v=22",
  "next/screens/clients.js?v=23",
  "next/screens/clients.js?v=24",
  "next/screens/history.js",
  "next/screens/history.js?v=15",
  "next/screens/home.js",
  "next/screens/home.js?v=24",
  "next/screens/report.js",
  "next/screens/report.js?v=16",
  "next/screens/schedule.js",
  "next/screens/schedule.js?v=14",
  "next/screens/schedule.js?v=24",
  "next/screens/settings.js",
  "next/screens/settings.js?v=14",
  "next/screens/settings.js?v=15",
  "next/screens/settings.js?v=16",
  "next/screens/train.js",
  "next/screens/train.js?v=14",
  "next/screens/train.js?v=24",
  "next/features/calendar.js",
  "next/features/calendar.js?v=14",
  "next/features/coaching.js",
  "next/features/coaching.js?v=24",
  "next/features/notes-fill.js",
  "next/features/notes-fill.js?v=15",
  "next/features/line-text.js",
  "next/features/line-text.js?v=16",
  "next/features/line-text.js?v=17",
  "next/features/line-text.js?v=22",
  "next/features/line-text.js?v=23",
  "next/features/line-text.js?v=24",
  "next/features/professional-feedback.js",
  "next/features/professional-feedback.js?v=1",
  "next/features/professional-feedback.js?v=22",
  "next/features/professional-feedback.js?v=24",
  "next/features/excel.js",
  "next/styles/tokens.css",
  "next/styles/app.css",
  "next/styles/home.css",
  "next/styles/home.css?v=4",
  "next/styles/home.css?v=5",
  "next/styles/clients.css",
  "next/styles/clients.css?v=4",
  "next/styles/clients.css?v=5",
  "next/styles/report.css",
  "next/styles/schedule.css",
  "next/styles/schedule.css?v=2",
  "next/styles/settings.css",
  "next/styles/train.css",
  "next/styles/train.css?v=14",
  "next/styles/train.css?v=5",
  "next/styles/train.css?v=6",
  "next/styles/history.css",
  "next/styles/history.css?v=4",
  "next/styles/muscle-map.css",
  "next/styles/muscle-map.css?v=1",
  "next/styles/layout-v2.css",
  "next/styles/layout-v2.css?v=1"
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
    fetch(e.request, { cache: "no-store" })
      .then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        /* ?v=14 のような版の違いは無視して拾う */
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
