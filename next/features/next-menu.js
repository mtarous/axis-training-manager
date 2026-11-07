/* 次回メニュー案。
   基準は「AXIS 分析基準とメニュー自動作成の基準」（2026-11-07）に合わせている。
   - 安全が先。中止レベルならメニューを作らない
   - 中心種目は変えない。変えるのは頭打ち・痛み・トレーナーが変えたときだけ
   - 1種目で上げるのは重さ・回数・セットのどれか1つ（ダブルプログレッション）
   - 1回の総負荷量は前回の +10% まで
   - 予定に入っていて記録がない過去の回は「直前と同じメニューをやった回」として
     頻度・間隔・部位の量にだけ数える。重さの判断は実際の記録だけで行う
   ここは記録を一切書き換えない。案を返すだけ。 */

import * as store from "../core/store.js?v=21";
import * as schedule from "../core/schedule.js?v=28";
import { BODYWEIGHT, num, round1, sessionVolume, today } from "../core/model.js?v=21";
import { safetyLevel, clientAdvice } from "./coaching.js?v=26";

/* ---- 調整できる数字（資料の表と同じ） ---- */
export const RULES = {
  blankDays: 14,          // これ以上空いたら「ブランクあり」
  blankLoad: 0.85,        // ブランク明けは前回の重さの85%から
  maxVolumeUp: 0.10,      // 1回の総負荷量の上限 +10%
  dropAfterMisses: 0.9,   // 2回続けてできなかったら10%下げる
  plateauRepeats: 3,      // 同じ設定がこの回数続いたら停滞・頭打ちを判定
  maxExercises: 7,
  maxSets: 20,
  maxAdds: 2,             // 偏りを補うために足す種目の上限
  windowDays: 28          // バランスを見る期間
};

/* 目標の言葉 → 回数の幅（資料「目的別の調整」） */
const PROFILES = [
  { key: "rehab",    re: /痛|リハビリ|膝|腰|肩|術後|けが|怪我/, label: "痛み・リハビリ", main: [10, 15], acc: [10, 15], rpe: "5〜6" },
  { key: "health",   re: /姿勢|健康|維持|高齢|転倒|歩/,        label: "姿勢・健康維持", main: [10, 15], acc: [10, 15], rpe: "6〜7" },
  { key: "diet",     re: /ダイエット|引き締め|減量|体重|脂肪/,  label: "ダイエット",     main: [10, 15], acc: [10, 15], rpe: "7〜8" },
  { key: "strength", re: /筋力|BIG3|重量|ベンチ.*kg|強く/,     label: "筋力",           main: [3, 6],   acc: [8, 12],  rpe: "7〜8" },
  { key: "sport",    re: /競技|試合|部活|スポーツ|ゴルフ|野球|サッカー|陸上|テニス/, label: "競技力", main: [3, 6], acc: [8, 12], rpe: "7〜8" },
  { key: "hyper",    re: /筋肥大|大きく|体づくり|ボディメイク|バルク/, label: "筋肥大・体づくり", main: [8, 12], acc: [8, 12], rpe: "7〜9" }
];
const DEFAULT_PROFILE = PROFILES[1];

export function profileOf(goal){
  const g = String(goal || "");
  return PROFILES.find(p => p.re.test(g)) || DEFAULT_PROFILE;
}

/* ---- 動作パターン（資料「分析基準 1」） ---- */
const PATTERNS = [
  ["vpull",  /ラット|プルダウン|懸垂|チンニング|プルアップ/i],
  ["vpush",  /ショルダープレス|ミリタリー|オーバーヘッド|パイクプッシュ/i],
  ["hpull",  /ロー(?!ル|テ)|ロウ|row|ローイング/i],
  ["hpush",  /ベンチ|チェスト|プッシュアップ|腕立て|ダンベルプレス|フライ|ディップス|push.?up/i],
  ["hip",    /デッド|rdl|ルーマニアン|ヒップスラスト|ヒップリフト|ヒンジ|レッグカール|バックエクステンション|グッドモーニング|スイング|ブリッジ(?!.*サイド)/i],
  ["knee",   /スクワット|レッグプレス|ランジ|ブルガリアン|ステップアップ|レッグエクステンション|立ち上がり|スプリット|lunge|squat/i],
  ["core",   /プランク|バードドッグ|クランチ|腹|デッドバグ|パロフ|体幹|サイドブリッジ|アブ|plank|マウンテンクライマー/i],
  ["arms",   /カール|トライセプ|三頭|二頭|キックバック|プレスダウン/i],
  ["shoulder", /レイズ|フェイスプル|外旋|内旋/i],
  ["calf",   /カーフ|かかと上げ|calf/i]
];
const LABEL = { knee:"膝主体（スクワット系）", hip:"股関節主体（ヒンジ系）", hpush:"横に押す", hpull:"横に引く",
  vpush:"上に押す", vpull:"上から引く", core:"体幹", single:"片脚・バランス", arms:"腕", shoulder:"肩まわり", calf:"ふくらはぎ" };
const COMPOUND = new Set(["knee", "hip", "hpush", "hpull", "vpush", "vpull"]);
const LOWER = new Set(["knee", "hip", "calf"]);

export function patternOf(name){
  const n = String(name || "");
  if(/片脚|シングル|バランス/.test(n) && !/スクワット|デッド|ブルガリアン|ランジ/.test(n)) return "single";
  if(/レッグカール/.test(n)) return "hip";
  const hit = PATTERNS.find(([, re]) => re.test(n));
  return hit ? hit[0] : "other";
}
const isTimed = name => /プランク|秒|サイドブリッジ|片脚立ち|ホールド|plank/i.test(String(name || ""));
const isSingleLeg = name => /片脚|シングル|ブルガリアン|ランジ|ステップアップ|スプリット|バランス/.test(String(name || ""));

/* 補うときに足す種目（器具の少ないものを優先。トレーナーが書き換える前提） */
const FILL = {
  hpull:  { name: "シーテッドロー",       body: false },
  vpull:  { name: "ラットプルダウン",     body: false },
  hip:    { name: "ヒップリフト",         body: true  },
  knee:   { name: "ボックススクワット",   body: true  },
  core:   { name: "バードドッグ",         body: true  },
  single: { name: "片脚立ち（秒）",       body: true, reps: 30 }
};

/* 頭打ちのとき、同じパターンの中で変える先 */
const VARIANTS = [
  [/バーベル.*スクワット|^スクワット$|バックスクワット/, "ブルガリアンスクワット"],
  [/レッグプレス/, "ブルガリアンスクワット"],
  [/デッドリフト(?!.*ルーマ)/, "ルーマニアンデッドリフト"],
  [/ルーマニアン|rdl/i, "ヒップスラスト"],
  [/ベンチプレス(?!.*インクライン)/, "インクラインダンベルプレス"],
  [/ダンベルプレス/, "プッシュアップ（重り付き）"],
  [/ラットプルダウン/, "ワンハンドロー"],
  [/ロー|ロウ/, "ラットプルダウン"],
  [/ショルダープレス/, "ランドマインプレス"]
];
function variantOf(name){
  const hit = VARIANTS.find(([re]) => re.test(String(name || "")));
  return hit && hit[1] !== name ? hit[1] : "";
}

/* 痛む部位ごとの置き換え（資料「安全基準」の表） */
const REGIONS = [
  { key: "膝", re: /膝|ひざ/, avoid: /スクワット|ランジ|ジャンプ|ホップ|レッグエクステンション|ブルガリアン/, to: "ボックススクワット（浅め）", body: true },
  { key: "腰", re: /腰/,       avoid: /デッドリフト|ベントオーバー|グッドモーニング/,                    to: "ヒップリフト", body: true },
  { key: "肩", re: /肩/,       avoid: /ショルダープレス|オーバーヘッド|ミリタリー|ディップス|アップライト/, to: "インクラインプッシュアップ", body: true }
];

/* ---- 読み取り ---- */
const isBody = e => e.sets.every(s => String(s.weight) === BODYWEIGHT);
const topWeight = e => Math.max(0, ...e.sets.map(s => String(s.weight) === BODYWEIGHT ? 0 : num(s.weight)));
const workSets = e => {
  const w = topWeight(e);
  return isBody(e) || !w ? e.sets : e.sets.filter(s => num(s.weight) === w);
};
const minReps = e => Math.min(...workSets(e).map(s => num(s.reps)));
function allDone(s, e){
  const d = s.done?.[e.id];
  if(!Array.isArray(d) || !d.length) return s.status !== "未完了";   // 旧記録はチェックが無いので「完了」扱い
  return d.length >= e.sets.length;
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/* 予定にあるのに記録がない過去の回。直前（なければ直後）の記録と同じメニューとして扱う。 */
export function estimatedSessions(clientId, real, until = today()){
  let items = [];
  try{ items = schedule.all() }catch(e){ items = [] }
  const recorded = new Set(real.map(s => s.date));
  const asc = [...real].sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set();
  return items
    .filter(x => x.date < until && (x.clientIds || []).includes(clientId) && !/ケア|体験/.test(x.type))
    .filter(x => !recorded.has(x.date) && !seen.has(x.date) && seen.add(x.date))
    .map(x => {
      const base = [...asc].reverse().find(s => s.date < x.date) || asc.find(s => s.date > x.date);
      return base ? { date: x.date, exercises: base.exercises, estimated: true } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* 直近 windowDays のパターンごとのセット数 */
function patternSets(list, until){
  const out = {};
  list.filter(s => daysBetween(s.date, until) <= RULES.windowDays).forEach(s =>
    s.exercises.forEach(e => {
      const p = patternOf(e.name);
      out[p] = (out[p] || 0) + e.sets.length;
      if(isSingleLeg(e.name) && p !== "single") out.single = (out.single || 0) + e.sets.length;
    }));
  return out;
}

/* 1種目の過去の記録（実記録だけ、新しい順） */
function history(real, name){
  return real.map(s => ({ s, e: s.exercises.find(x => x.name === name) })).filter(x => x.e);
}

function weightStep(pattern, w){
  if(LOWER.has(pattern)) return w >= 60 ? 5 : 2.5;
  return w >= 20 ? 2.5 : 1;
}
const roundHalf = x => Math.max(0, Math.round(x * 2) / 2);

/* ---- 1種目の次回設定 ---- */
function progress(item, ctx){
  const { e, s } = item;
  const pattern = patternOf(e.name);
  const role = item.role;
  const prof = ctx.profile;
  const goal = role === "main" ? prof.main : prof.acc;
  const reps = minReps(e);
  /* 今の回数が目標の幅から大きく外れているときは、急に変えず今の回数を軸にする */
  const inRange = reps >= goal[0] - 2 && reps <= goal[1] + 2;
  const [lo, hi] = inRange ? goal : [reps, reps + 2];
  const sets = e.sets.map(x => ({ weight: x.weight, reps: x.reps, side: x.side }));
  const notes = [];
  if(!inRange && !isBody(e)) notes.push("目標（" + prof.label + "）の回数帯は" + goal[0] + "〜" + goal[1] + "回。少しずつ寄せる候補");

  const hist = history(ctx.real, e.name);
  const done = allDone(s, e);
  const rpe = num(s.rpe, 0);
  const prevMiss = hist[1] ? !allDone(hist[1].s, hist[1].e) : false;
  const same = hist.slice(0, RULES.plateauRepeats).filter(h =>
    topWeight(h.e) === topWeight(e) && minReps(h.e) === reps).length;

  /* ブランク明け：重さを下げ、セットを1つ減らす */
  if(ctx.blank){
    if(!isBody(e) && topWeight(e)){
      const w = roundHalf(topWeight(e) * RULES.blankLoad);
      sets.forEach(x => { if(String(x.weight) !== BODYWEIGHT && num(x.weight) >= w) x.weight = w });
    }
    if(sets.length > 1) sets.pop();
    return { sets, change: "blank", why: "前回から" + ctx.gap + "日空いたので、重さを85%・セットを1つ減らして様子を見る", notes };
  }

  /* 注意レベル：上げない */
  if(ctx.level === "careful") return { sets, change: "hold", why: "痛み・きつさ・体調の記載があるので、前回と同じ設定", notes };

  /* 2回続けてできなかった → 10%下げる */
  if(!done && prevMiss && !isBody(e)){
    const w = roundHalf(topWeight(e) * RULES.dropAfterMisses);
    sets.forEach(x => { if(String(x.weight) !== BODYWEIGHT && num(x.weight) > w) x.weight = w });
    return { sets, change: "down", why: "2回続けて全セットできなかったので、重さを10%下げる", notes };
  }

  /* 頭打ち：同じ設定が続き、できない・きつい → 同じパターンの別種目へ */
  if(same >= RULES.plateauRepeats && (!done || rpe >= 9)){
    const to = variantOf(e.name);
    if(to) return { sets, change: "swap", swapTo: to, why: "同じ設定が" + same + "回続き、きつさも高い（頭打ち）。同じ動きの" + to + "に変える。初回は軽めで基準を取る", notes };
    return { sets, change: "hold", why: "同じ設定が" + same + "回続いて頭打ち。フォーム・休憩・種目順を確認", notes };
  }

  if(!done || rpe >= 9) return { sets, change: "hold", why: !done ? "前回できないセットがあったので、同じ設定をもう一度" : "前回のきつさが" + rpe + "と高いので、同じ設定をもう一度", notes };

  /* 秒で数える種目（プランク・片脚立ちなど）：5秒ずつ、60秒まで */
  if(isBody(e) && isTimed(e.name)){
    if(reps >= 60){
      notes.push("60秒に届いた。片手・片脚にするなど、難しいやり方に変える候補");
      return { sets, change: "hold", why: "秒数が上限（60秒）に届いた", notes };
    }
    sets.forEach(x => { x.reps = Math.min(60, num(x.reps) + 5) });
    return { sets, change: "reps", why: "全セットできたので5秒延ばす（数字は秒）", notes };
  }

  /* 自重：回数を足す。上限を超えたら難しいやり方へ */
  if(isBody(e)){
    if(reps >= hi){
      notes.push("回数が上限（" + hi + "回）に届いた。片脚・ゆっくり・重りを持つなど、難しいやり方に変える候補");
      return { sets, change: "hold", why: "自重で上限に届いた", notes };
    }
    const add = Math.min(2, hi - reps);
    sets.forEach(x => { x.reps = num(x.reps) + add });
    return { sets, change: "reps", why: "全セットできたので回数を" + add + "回増やす", notes };
  }

  /* ダブルプログレッション */
  if(reps >= hi){
    const w = topWeight(e);
    const step = weightStep(pattern, w);
    sets.forEach(x => {
      if(String(x.weight) !== BODYWEIGHT && num(x.weight) === w){ x.weight = round1(w + step); x.reps = lo }
    });
    return { sets, change: "weight", step, why: "全セットで上限" + hi + "回に届いたので、" + step + "kg上げて" + lo + "回から", notes,
      stalledBefore: same >= RULES.plateauRepeats };
  }
  const add = Math.min(2, hi - reps);
  sets.forEach(x => { if(String(x.weight) !== BODYWEIGHT && num(x.weight) === topWeight(e)) x.reps = Math.max(num(x.reps), reps + add) });
  return { sets, change: "reps", why: "全セットできたので、同じ重さで回数を" + add + "回増やす（上限" + hi + "回）", notes };
}

/* 総負荷量が前回の +10% を超えたら、後ろの種目から上げ幅を戻す */
const volOf = list => list.reduce((a, x) => a + x.sets.reduce((b, y) => b + (String(y.weight) === BODYWEIGHT ? 0 : num(y.weight) * num(y.reps)), 0), 0);

/* ---- 本体 ---- */
export function buildNextMenu(clientId, { until = today() } = {}){
  const client = store.client(clientId);
  const real = store.sessions({ clientId });
  if(!client || !real.length) return null;

  const last = real[0];
  const est = estimatedSessions(clientId, real, until);
  const all = [...real, ...est].sort((a, b) => b.date.localeCompare(a.date));
  const lastActive = all[0].date;
  const gap = daysBetween(lastActive, until);
  const profile = profileOf(client.goal);
  const level = safetyLevel(clientId);
  const reasons = [];

  if(level === "stop"){
    const safety = clientAdvice(clientId).find(a => a.level === "safety");
    return { level, profile, exercises: [], reasons: [safety ? safety.text : "前回の記録に強い痛みや体調の異常があります。メニューを作らず、状態の確認を優先してください。"], estimated: est.length, gap };
  }

  const blank = gap >= RULES.blankDays;
  const ctx = { real, profile, level, blank, gap };
  const text = [client.attention, client.goal, last.notes?.caution, last.notes?.insight, last.notes?.share].join(" ");
  const painNow = num(last.pain, 0) >= 4 || level === "careful";
  const regions = REGIONS.filter(r => r.re.test(text));

  /* 中心種目 = 前回の最初の方にある多関節種目（最大2つ） */
  let mains = 0;
  const items = last.exercises.filter(e => e.name).map(e => {
    const p = patternOf(e.name);
    const role = COMPOUND.has(p) && mains < 2 ? (mains++, "main") : (p === "core" ? "core" : "acc");
    return { e, s: last, role, pattern: p };
  });

  let out = items.map(it => {
    const r = progress(it, ctx);
    let name = it.e.name, sets = r.sets, why = r.why;
    if(r.change === "swap"){ name = r.swapTo; const known = lastWeightOf(real, name); sets = sets.map(x => ({ ...x, weight: known ?? 0 })) }
    /* 痛みがある部位に負担がかかる種目は置き換える */
    const region = painNow && regions.find(g => g.avoid.test(name));
    if(region){
      why = region.key + "に痛みの記載があるので、" + name + "を" + region.to + "に置き換え";
      name = region.to;
      sets = sets.map(x => ({ weight: region.body ? BODYWEIGHT : x.weight, reps: Math.max(10, num(x.reps)), side: x.side }));
    }
    return { name, role: it.role, pattern: patternOf(name), sets, why, notes: r.notes, change: region ? "swap" : r.change, from: it.e.name };
  });

  /* 総負荷量の上限 */
  const base = volOf(items.map(it => it.e));
  if(base > 0){
    for(let i = out.length - 1; i >= 0 && volOf(out) > base * (1 + RULES.maxVolumeUp); i--){
      const o = out[i];
      if(o.change === "weight" || o.change === "reps"){
        o.sets = items[i].e.sets.map(x => ({ weight: x.weight, reps: x.reps, side: x.side }));
        o.why = "総負荷量を前回の+10%以内に抑えるため、この種目は前回と同じ";
        o.change = "hold";
      }
    }
  }

  /* 偏りを補う（ブランク明け・注意レベルでは足さない） */
  const counts = patternSets(all, until);
  const adds = [];
  if(!blank && level === "ok"){
    const push = (counts.hpush || 0) + (counts.vpush || 0);
    const pull = (counts.hpull || 0) + (counts.vpull || 0);
    const want = [];
    if(push > 0 && pull * 1.5 < push) want.push(["hpull", "押す種目" + push + "セットに対して引く種目" + pull + "セット（直近4週）"]);
    if(!counts.hip && (counts.knee || 0) > 0) want.push(["hip", "直近4週に股関節主体（ヒンジ系）がない"]);
    if(!counts.knee && (counts.hip || 0) > 0 && !regions.some(r => r.key === "膝")) want.push(["knee", "直近4週に膝主体（スクワット系）がない"]);
    if(!counts.core) want.push(["core", "直近4週に体幹の種目がない"]);
    if(["health", "rehab"].includes(profile.key) && !counts.single) want.push(["single", "片脚・バランスの種目がない（転倒予防）"]);
    want.forEach(([p, why]) => {
      if(adds.length >= RULES.maxAdds || out.some(o => o.pattern === p)) return;
      const f = FILL[p];
      const known = lastWeightOf(real, f.name);
      adds.push({ name: f.name, role: p === "core" || p === "single" ? "core" : "acc", pattern: p,
        sets: Array.from({ length: 2 }, () => ({ weight: f.body ? BODYWEIGHT : (known ?? 0), reps: f.reps || (f.body ? Math.max(12, profile.acc[0]) : profile.acc[0]), side: "" })),
        why: "偏りを補う：" + why, notes: f.body || known != null ? [] : ["初めての種目。重さは当日、軽めで基準を取る"], change: "add" });
    });
  }
  /* 足したら、多い側の補助種目を1つ減らす（中心種目は減らさない） */
  adds.forEach(a => {
    if(out.length + 1 <= RULES.maxExercises - 1) return;
    const i = out.map(o => o.role).lastIndexOf("acc");
    if(i >= 0){ reasons.push("種目数を保つため、" + out[i].name + "を今回は外す"); out.splice(i, 1) }
  });
  out = [...out.filter(o => o.role === "main"), ...out.filter(o => o.role === "acc"), ...adds.filter(a => a.role === "acc"),
    ...out.filter(o => o.role === "core"), ...adds.filter(a => a.role === "core")].slice(0, RULES.maxExercises);

  /* セットの合計が多すぎたら補助から1セットずつ減らす */
  let total = out.reduce((a, o) => a + o.sets.length, 0);
  for(let i = out.length - 1; total > RULES.maxSets && i >= 0; i--){
    if(out[i].role !== "main" && out[i].sets.length > 2){ out[i].sets.pop(); total--; i++ }
  }

  /* 全体の理由 */
  reasons.unshift("目標：" + profile.label + "（中心種目" + profile.main[0] + "〜" + profile.main[1] + "回、きつさ" + profile.rpe + "）" + (client.goal ? "" : "。目標が未登録なので健康維持として作成"));
  if(level === "careful") reasons.push("前回、痛み・きつさ・体調の記載があるため、重さは上げず置き換え中心");
  if(blank) reasons.push("前回から" + gap + "日空いています。ブランク明けの設定");
  if(est.length) reasons.push("予定にあって記録がない回が" + est.length + "回あり、直前と同じメニューをやった回として頻度と部位の量に入れています");
  const perWeek = round1(all.filter(s => daysBetween(s.date, until) <= RULES.windowDays).length / 4);
  if(perWeek < 2) reasons.push("直近4週は週" + perWeek + "回。主な部位は週2回が目安なので、自宅メニューを案内");
  reasons.push("ウォームアップ：中心種目を軽い重さで1〜2セット。痛みと動きを確認してから本番");

  const home = perWeek < 2 ? homeMenu(profile, regions) : [];
  return { level, profile, exercises: out, reasons, home, estimated: est.length, gap, perWeek };
}

function lastWeightOf(real, name){
  const h = history(real, name)[0];
  return h ? (isBody(h.e) ? BODYWEIGHT : topWeight(h.e)) : null;
}

function homeMenu(profile, regions){
  const knee = regions.some(r => r.key === "膝");
  if(["health", "rehab"].includes(profile.key)){
    return [knee ? "椅子に浅く座って立ち上がる（浅め）10回×2" : "椅子からの立ち上がり 10回×2",
      "片脚立ち 左右30秒×2（つかまれる所で）", "かかと上げ 15回×2", "週3回以上、12週を目安に続ける"];
  }
  return [knee ? "ヒップリフト 15回×2" : "スクワット 15回×2", "プッシュアップ（膝つき可）10回×2", "プランク 30秒×2", "週1〜2回、ジムに来ない日に"];
}

/* 案を、トレ中入力でそのまま使える形に */
export function planToExercises(plan){
  return (plan?.exercises || []).map(o => ({ name: o.name, sets: o.sets.map(x => ({ weight: x.weight, reps: x.reps, side: x.side })) }));
}
