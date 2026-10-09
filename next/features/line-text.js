/* 利用者に送るLINE文面を組み立てる。
   旧アプリの professionalAdvice / professionalLine を v2 のデータで作り直したもの。
   文面はそのまま送る前提ではなく、直して使うたたき台。 */

import { lineAdvice, safetyLevel } from "./coaching.js?v=21";
import { musclesOfSession } from "../core/muscles.js?v=21";
import * as sched from "../core/schedule.js?v=21";
import * as store from "../core/store.js?v=21";
import { clientSummary, nextTargets } from "../core/stats.js?v=21";
import { today } from "../core/model.js?v=21";
import { professionalFeedback } from "./professional-feedback.js?v=21";

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d
    : x.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
};

/* 名前の呼びかけ。「青木 理沙」→「青木さん」 */
function callName(name){
  const s = String(name || "").trim();
  if(/さん$|様$|さま$/.test(s)) return s;
  const head = s.split(/[\s　]+/)[0];
  return (head || s) + "さん";
}

/* 次の予定。無ければ null */
export function nextAppointment(clientId){
  const t = today();
  return sched.all().find(x => (x.clientId === clientId || x.clientIds?.includes(clientId)) && x.date >= t) || null;
}

/* 今日のポイントは coaching.js が記録から組み立てる。
   ここでは文面に載せる形に整えるだけ。 */
export function coachingAdvice(client){
  return lineAdvice(client.id);
}

export function lineMessage(clientId){
  const client = store.client(clientId);
  if(!client) return "";
  const s = clientSummary(clientId);
  if(!s.last) return callName(client.name) + "\u3001\u672c\u65e5\u3082\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3057\u305f\u3002";

  const last = s.last;
  const muscles = musclesOfSession(last);
  const level = safetyLevel(clientId);
  const pro = professionalFeedback(clientId);
  const appt = nextAppointment(clientId);
  const clean = v => String(v || "").replace(/^\u30fb/gm, "").trim();
  const first = v => {
    const x = clean(v);
    if(!x) return "";
    const m = x.match(/^.*?[\u3002\uff01\uff1f]/);
    return m ? m[0] : x;
  };
  const soften = v => first(v)
    .replace(/\u80a9\u7532\u9aa8\u306e\u4e0b\u5236\u30fb\u5185\u8ee2/g, "\u80a9\u7532\u9aa8\u3092\u4e0b\u3052\u3066\u5bc4\u305b\u308b\u52d5\u304d")
    .replace(/\u819d\u306e\u5185\u5074\u504f\u4f4d/g, "\u819d\u304c\u5185\u5074\u306b\u5165\u308b\u52d5\u304d")
    .replace(/\u9aa8\u76e4\u306e\u5074\u65b9\u50be\u659c/g, "\u9aa8\u76e4\u306e\u5de6\u53f3\u306e\u50be\u304d")
    .replace(/\u5e8a\u53cd\u529b/g, "\u5730\u9762\u304b\u3089\u8fd4\u3063\u3066\u304f\u308b\u529b")
    .replace(/\u5916\u529b\u30e2\u30fc\u30e1\u30f3\u30c8/g, "\u8170\u3078\u306e\u8ca0\u62c5")
    .replace(/\u4ee3\u511f\u52d5\u4f5c/g, "\u304b\u3070\u3046\u52d5\u304d")
    .replace(/\u4e3b\u89b3\u7684\u904b\u52d5\u5f37\u5ea6/g, "\u4eca\u56de\u306e\u904b\u52d5\u5f37\u5ea6")
    .replace(/\u4e0b\u534a\u8eab\u3067\u306f\u5927\u81c0\u7b4b\u30fb\u5927\u817f\u56db\u982d\u7b4b\u30fb\u30cf\u30e0\u30b9\u30c8\u30ea\u30f3\u30b0\u30b9\u3092\u4f7f\u3044\u3001\u80a1\u95a2\u7bc0\u3068\u819d\u95a2\u7bc0\u306e\u4f38\u5c55\u3092\u5354\u8abf\u3055\u305b\u307e\u3059\u3002/g, "\u304a\u5c3b\u30fb\u592a\u3082\u3082\u306e\u524d\u5f8c\u3092\u4f7f\u3044\u306a\u304c\u3089\u3001\u80a1\u95a2\u7bc0\u3068\u819d\u3092\u9023\u52d5\u3055\u305b\u3066\u4f38\u3070\u3059\u52d5\u304d\u3067\u3059\u3002")
    .replace(/\u62bc\u3059\u52d5\u4f5c\u3067\u306f\u5927\u80f8\u7b4b.*?\u884c\u3044\u307e\u3059\u3002/g, "\u80f8\u30fb\u80a9\u30fb\u8155\u3092\u9023\u52d5\u3055\u305b\u3066\u62bc\u3059\u52d5\u304d\u3067\u3059\u3002")
    .replace(/\u5f15\u304f\u52d5\u4f5c\u3067\u306f\u5e83\u80cc\u7b4b.*?\u652f\u3048\u307e\u3059\u3002/g, "\u80cc\u4e2d\u3068\u8155\u3092\u4f7f\u3044\u306a\u304c\u3089\u3001\u80a9\u7532\u9aa8\u3092\u5b89\u5b9a\u3055\u305b\u3066\u5f15\u304f\u52d5\u304d\u3067\u3059\u3002")
    .replace(/\u5f8c\u9762\u3067\u306f\u5927\u81c0\u7b4b.*?\u767a\u63ee\u3057\u307e\u3059\u3002/g, "\u304a\u5c3b\u30fb\u3082\u3082\u88cf\u3092\u4e2d\u5fc3\u306b\u3001\u80a1\u95a2\u7bc0\u304b\u3089\u529b\u3092\u51fa\u3059\u52d5\u304d\u3067\u3059\u3002");

  const names = {
    "\u80f8":"\u5927\u80f8\u7b4b", "\u80a9":"\u4e09\u89d2\u7b4b", "\u4e09\u982d":"\u4e0a\u8155\u4e09\u982d\u7b4b", "\u4e8c\u982d":"\u4e0a\u8155\u4e8c\u982d\u7b4b",
    "\u30cf\u30e0":"\u30cf\u30e0\u30b9\u30c8\u30ea\u30f3\u30b0\u30b9", "\u81c0\u7b4b":"\u81c0\u7b4b\u7fa4", "\u8179\u7b4b":"\u8179\u7b4b\u7fa4", "\u3075\u304f\u3089\u306f\u304e":"\u4e0b\u817f\u4e09\u982d\u7b4b"
  };
  const trained = muscles.length ? muscles.slice(0,4).map(m => names[m] || m).join("\u30fb") : "\u5168\u8eab";

  const todayLines = ["\u4eca\u56de\u306f" + trained + "\u3092\u4e2d\u5fc3\u306b\u30c8\u30ec\u30fc\u30cb\u30f3\u30b0\u3057\u307e\u3057\u305f\u3002"];
  const anatomy = soften(pro?.anatomy);
  const biomechanics = soften(pro?.biomechanics).replace(/^\u4e3b\u8ca0\u8377\u7a2e\u76ee\u306e.+?\u3067\u306f\u3001/, "");
  const physiology = soften(pro?.physiology);
  if(anatomy) todayLines.push(anatomy);
  if(biomechanics) todayLines.push("\u30d5\u30a9\u30fc\u30e0\u306f\u3001" + biomechanics);
  if(s.delta !== null){
    if(s.delta >= 5) todayLines.push("\u7dcf\u8ca0\u8377\u91cf\u306f\u524d\u56de\u6bd4\uff0b" + s.delta + "%\u3067\u3001\u7121\u7406\u306a\u304f\u30c8\u30ec\u30fc\u30cb\u30f3\u30b0\u91cf\u3092\u4f38\u3070\u305b\u3066\u3044\u307e\u3059\u3002");
    else if(s.delta <= -10) todayLines.push("\u7dcf\u8ca0\u8377\u91cf\u306f\u524d\u56de\u6bd4" + s.delta + "%\u3067\u3057\u305f\u3002\u4eca\u56de\u306f\u6570\u5024\u3088\u308a\u3082\u30d5\u30a9\u30fc\u30e0\u3068\u4f53\u8abf\u3092\u512a\u5148\u3057\u3066\u3044\u307e\u3059\u3002");
    else todayLines.push("\u7dcf\u8ca0\u8377\u91cf\u306f\u524d\u56de\u6bd4" + (s.delta > 0 ? "\uff0b" : "") + s.delta + "%\u3067\u3001\u524d\u56de\u306b\u8fd1\u3044\u8ca0\u8377\u3092\u5b89\u5b9a\u3057\u3066\u884c\u3048\u3066\u3044\u307e\u3059\u3002");
  }
  if(physiology) todayLines.push(physiology);
  if(last.notes?.insight) todayLines.push(clean(last.notes.insight));

  const recoveryLines = [];
  const nutrition = soften(pro?.nutrition);
  const care = soften(pro?.care);
  const self = soften(pro?.self);
  if(nutrition) recoveryLines.push(nutrition);
  if(care) recoveryLines.push("\u8eab\u4f53\u306e\u30b1\u30a2\u306f\u3001" + care);
  if(self) recoveryLines.push("\u81ea\u5b85\u3067\u306f\u3001" + self.replace(/^(?:\u81ea\u5b85\u3067\u306f\u3001)?(?:\u30bb\u30eb\u30d5\u904b\u52d5\u306f)?/, ""));

  let next = "";
  if(level === "stop") next = "\u6b21\u56de\u306f\u8ca0\u8377\u3092\u4e0a\u3052\u305a\u3001\u75c7\u72b6\u306e\u78ba\u8a8d\u3092\u512a\u5148\u3057\u307e\u3059\u3002\u75c7\u72b6\u304c\u7d9a\u304f\u3001\u307e\u305f\u306f\u5f37\u304f\u306a\u308b\u5834\u5408\u306f\u533b\u7642\u6a5f\u95a2\u3078\u306e\u76f8\u8ac7\u3092\u512a\u5148\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
  else if(level === "careful") next = "\u6b21\u56de\u306f\u91cd\u91cf\u3092\u636e\u3048\u7f6e\u304d\u3001\u75db\u307f\u3084\u9055\u548c\u611f\u304c\u51fa\u306a\u3044\u7bc4\u56f2\u3067\u30d5\u30a9\u30fc\u30e0\u3092\u78ba\u8a8d\u3057\u307e\u3059\u3002";
  else if(last.notes?.next) next = clean(last.notes.next);
  else {
    const list = nextTargets(clientId, 3);
    next = list.length ? list.map(t => t.name + "\uff1a" + String(t.text).replace(/\u3092\u8a66\u3059$/, "\u3092\u76ee\u5b89\u306b\u9032\u3081\u307e\u3059")).join("\n") : "\u4eca\u56de\u306e\u5185\u5bb9\u3092\u57fa\u6e96\u306b\u3001\u4f53\u8abf\u3068\u30d5\u30a9\u30fc\u30e0\u3092\u898b\u306a\u304c\u3089\u8ca0\u8377\u3092\u8abf\u6574\u3057\u307e\u3059\u3002";
  }

  const safety = level !== "ok" ? "\n\n\u3010\u4f53\u8abf\u9762\u3011\n" + lineAdvice(clientId)[0] : "";
  const dateLine = appt
    ? "\u6b21\u56de\u306f" + jp(appt.date) + " " + appt.time + "\u301c\u306e\u3054\u4e88\u7d04\u3067\u3059\u3002\u3054\u90fd\u5408\u306f\u5927\u4e08\u592b\u3067\u3057\u3087\u3046\u304b\uff1f"
    : "\u6b21\u56de\u306e\u3054\u4e88\u7d04\u304c\u307e\u3060\u5165\u3063\u3066\u3044\u307e\u305b\u3093\u3002\u3054\u90fd\u5408\u306e\u826f\u3044\u65e5\u6642\u3092\u6559\u3048\u3066\u304f\u3060\u3055\u3044\u3002";

  return callName(client.name) + "\u3001\u672c\u65e5\u3082\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3057\u305f\ud83d\ude0a\n\n" +
    "\u3010\u4eca\u65e5\u306e\u30dd\u30a4\u30f3\u30c8\u3011\n" + todayLines.join("\n") + safety + "\n\n" +
    "\u3010\u56de\u5fa9\u30fb\u30bb\u30eb\u30d5\u30b1\u30a2\u3011\n" + recoveryLines.join("\n") + "\n\n" +
    "\u3010\u6b21\u56de\u3011\n" + next + "\n\n" + dateLine + "\n" +
    "\u307e\u305f\u6b21\u56de\u3082\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3057\u307e\u3059\ud83d\ude0a";
}
