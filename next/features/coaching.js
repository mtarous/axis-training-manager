/* 記録からトレーニングの助言を組み立てる。
   方針は healthcare-rehabilitation-advisor の安全基準に合わせている。
   - 安全が先。痛み・神経症状・全身症状があれば、負荷の話より受診と中止基準を出す
   - 診断名は付けない。「可能性」と「確認しましょう」で止める
   - 高齢・有痛・術後は保守的に。進めるのは安全が確認できたときだけ */

import { BODYWEIGHT, num, sessionVolume } from "../core/model.js?v=21";
import { musclesForExercise } from "../core/muscles.js?v=21";
import * as store from "../core/store.js?v=21";

/* 症状メモは「緊急性が高い所見」と「要確認の所見」を分ける。
   しびれ等を一律に緊急扱いせず、持続・増悪・筋力低下の有無も確認する。 */
const URGENT_FLAGS = [
  [/排尿.*(できない|困難)|尿が出ない|尿失禁|便失禁|会陰.*(しびれ|感覚)|サドル.*(しびれ|感覚)/, "排尿・排便や会陰部の異常"],
  [/(急|突然).*(脱力|力が入らない)|麻痺/, "急な筋力低下・麻痺"],
  [/胸痛|胸が苦しい|呼吸困難|息ができない|失神|意識を失/, "胸部・呼吸・意識の異常"]
];

const CAUTION_FLAGS = [
  [/しびれ|痺れ/, "しびれ"],
  [/夜間痛|夜中.*痛|眠れ.*痛/, "夜間の痛み"],
  [/発熱|熱が/, "発熱"],
  [/めまい|眩暈/, "めまい"],
  [/息切れ|息苦/, "息切れ"],
  [/脱力|力が入らない/, "脱力"],
  [/転倒|転んだ/, "転倒"],
  [/腫れ|腫脹/, "腫れ"]
];

/* 押す / 引く / 下半身 / 体幹 のどれに寄っているか */
function category(name){
  const parts = musclesForExercise(name);
  if(parts.some(p => ["大腿四頭筋","臀筋","ハム","ふくらはぎ"].includes(p))) return "下半身";
  if(parts.some(p => ["広背筋","二頭"].includes(p))) return "引く";
  if(parts.some(p => ["胸","三頭"].includes(p))) return "押す";
  if(parts.some(p => ["腹筋","脊柱起立筋"].includes(p))) return "体幹";
  if(parts.includes("肩")) return "押す";
  return "その他";
}

const topSet = e => e.sets.reduce((a, s) =>
  (typeof s.weight === "number" && s.weight > (typeof a.weight === "number" ? a.weight : -1) ? s : a), e.sets[0]);

const isBody = e => e.sets.every(s => String(s.weight) === BODYWEIGHT);

/* 1種目ぶんの推移。直近3回ぶんを見る。 */
function exerciseTrend(sessions, name){
  const hits = sessions
    .map(s => ({ date: s.date, e: s.exercises.find(x => x.name === name) }))
    .filter(x => x.e)
    .slice(0, 4);
  if(hits.length < 2) return { name, state: "new", hits };

  const val = h => {
    const t = topSet(h.e);
    return isBody(h.e)
      ? { w: 0, r: Math.max(...h.e.sets.map(s => s.reps)), body: true }
      : { w: num(t.weight), r: t.reps, body: false };
  };
  const now = val(hits[0]), prev = val(hits[1]);
  const key = v => v.body ? "回数 " + v.r + "回" : v.w + "kg × " + v.r + "回";

  if(now.body){
    if(now.r > prev.r) return { name, state: "up", now, prev, text: key(now), body: true };
    if(now.r < prev.r) return { name, state: "down", now, prev, text: key(now), body: true };
  }else{
    if(now.w > prev.w) return { name, state: "up", now, prev, text: key(now) };
    if(now.w < prev.w) return { name, state: "down", now, prev, text: key(now) };
    if(now.r > prev.r) return { name, state: "up", now, prev, text: key(now) };
  }
  /* 同じ重量×同じ回数が3回以上続いていれば停滞とみなす */
  const same = hits.filter(h => {
    const v = val(h);
    return v.w === now.w && v.r === now.r;
  }).length;
  return { name, state: same >= 3 ? "stall" : "flat", now, prev, text: key(now), body: now.body, same };
}

export function assess(clientId){
  const list = store.sessions({ clientId });
  const client = store.client(clientId);
  const last = list[0];
  if(!last) return null;

  const names = [...new Set(last.exercises.map(e => e.name))];
  const trends = names.map(n => exerciseTrend(list, n));

  /* 部位の偏り。直近3回をまとめて見る。 */
  const recent = list.slice(0, 3);
  const counts = { 押す: 0, 引く: 0, 下半身: 0, 体幹: 0 };
  recent.forEach(s => s.exercises.forEach(e => {
    const c = category(e.name);
    if(counts[c] !== undefined) counts[c] += 1;
  }));

  /* 前回からの間隔 */
  const gap = list[1]
    ? Math.round((Date.parse(last.date) - Date.parse(list[1].date)) / 86400000)
    : null;

  const text = [last.notes.insight, last.notes.caution, last.notes.share].join(" ");
  const urgentFlags = URGENT_FLAGS.filter(([re]) => re.test(text)).map(([, label]) => label);
  const flags = CAUTION_FLAGS.filter(([re]) => re.test(text)).map(([, label]) => label);

  const vol = Math.round(sessionVolume(last));
  const prevVol = list[1] ? Math.round(sessionVolume(list[1])) : 0;

  return {
    client, last, count: list.length, trends, counts, gap, flags, urgentFlags,
    pain: num(last.pain, 0),
    rpe: num(last.rpe, 0),
    volume: vol,
    delta: prevVol ? Math.round((vol - prevVol) / prevVol * 100) : null,
    repAvg: Math.round(last.exercises.flatMap(e => e.sets.map(s => s.reps))
      .reduce((a, b, _, arr) => a + b / arr.length, 0))
  };
}

/* トレーナー向け。根拠を添えて具体的に書く。 */
export function clientAdvice(clientId){
  const a = assess(clientId);
  if(!a) return [];
  const goal = String(a.client?.goal || "");
  const out = [];

  /* --- 安全が先。症状の強さと性質を分けて扱う --- */
  if(a.urgentFlags?.length){
    out.push({ level: "safety", text:
      a.urgentFlags.join("・") + "の記載があります。運動は中止し、医療機関への相談を優先してください。"
      + "急な悪化や強い全身症状がある場合は、救急受診を含めて早めの対応を検討してください。" });
    return out;
  }
  if(a.flags.length){
    out.push({ level: "safety", text:
      a.flags.join("・") + "の記載があります。症状の部位・持続時間・増減と、筋力低下の有無を確認しながら負荷を調整します。"
      + "症状が続く・強くなる、または脱力を伴う場合は医療機関への相談を優先してください。" });
  }
  if(a.pain >= 7){
    out.push({ level: "safety", text:
      "痛みが" + a.pain + "/10と強く出ています。次回は負荷を上げず、運動で明らかに増悪しない範囲を確認します。"
      + "安静時痛・夜間痛・外傷後の強い痛み・神経症状を伴う場合は医療機関への相談を優先してください。" });
  }else if(a.pain >= 4){
    out.push({ level: "safety", text:
      "痛みが" + a.pain + "/10あります。一律の痛み数値だけで判断せず、運動中に増悪するか、終了後から翌日にかけて強く残るかを見ながら可動域・負荷・種目を調整します。" });
  }

  /* --- 負荷の掛かり方 --- */
  if(a.rpe >= 9){
    out.push({ level: "load", text:
      "入力された運動のきつさが" + a.rpe + "/10と高めです。次回は自動的に重量を増やさず、回復状態・フォーム・可動域・反復速度を確認してから負荷を決めます。" });
  }

  const stalled = a.trends.filter(t => t.state === "stall");
  if(stalled.length){
    const t = stalled[0];
    out.push({ level: "progress", text:
      t.name + "は同じ設定が" + t.same + "回続いています。これだけで停滞とは判断せず、"
      + "フォーム・可動域・本人のきつさ・休憩時間・種目順が近い条件かを確認します。目標回数を余裕を持って再現できる場合に、重量・回数・セット数のいずれかを段階的に調整します。" });
  }

  const dropped = a.trends.filter(t => t.state === "down");
  if(dropped.length && a.pain < 4){
    out.push({ level: "progress", text:
      dropped[0].name + "は前回より記録が下がっています。1回の変化だけで筋力低下とは判断せず、"
      + "睡眠・疲労・前回からの間隔・フォームや可動域の違いも含めて次回の反応を確認します。" });
  }

  const rising = a.trends.filter(t => t.state === "up");
  if(rising.length >= 2 && a.pain < 4 && a.rpe < 9){
    out.push({ level: "progress", text:
      rising.slice(0, 2).map(t => t.name).join("・") + "で前回より高い重量または回数が記録されています。"
      + "フォーム・可動域・本人のきつさなどの条件も同程度なら、パフォーマンスが向上している可能性があります。次回は再現性を確認してから負荷を進めます。" });
  }

  /* --- プログラム構成の偏り。病態や姿勢を断定せず、構成上の確認として扱う --- */
  const { 押す: push, 引く: pull, 下半身: lower, 体幹: core } = a.counts;
  if(push >= 2 && pull === 0){
    out.push({ level: "balance", text:
      "直近3回は押す種目が中心です。目標との整合を確認し、必要に応じて引く種目も加えて上半身の運動パターンを分散します。" });
  }else if(pull >= 2 && push === 0){
    out.push({ level: "balance", text:
      "直近3回は引く種目が中心です。目標との整合を確認し、必要に応じて押す種目も組み合わせます。" });
  }
  if(lower === 0 && (push + pull) >= 2){
    out.push({ level: "balance", text:
      "直近3回は上半身種目が中心です。全身の筋力・機能向上が目標であれば、下半身種目を組み込む余地があります。" });
  }
  if(core === 0 && a.count >= 3){
    out.push({ level: "balance", text:
      "直近3回は体幹を単独で狙う種目がありません。スクワットやローイング等でも体幹は働くため、単独種目の追加は目標やフォーム課題に応じて判断します。" });
  }

  /* --- 目標との整合 --- */
  if(/筋力|BIG3|重量/.test(goal) && a.repAvg >= 14){
    out.push({ level: "goal", text:
      "筋力向上が主目標に対して、直近は平均" + a.repAvg + "回と高回数寄りです。高回数にも意味はありますが、筋力向上ではより高い負荷を扱う練習も必要になるため、フォームと安全性を確認しながら負荷帯を見直します。" });
  }
  if(/筋肥大|大きく/.test(goal)){
    out.push({ level: "goal", text:
      "筋肥大は特定の回数帯だけで決まるわけではありません。週あたりの十分なセット数、各セットの努力度、継続性を見ながら、本人が安定して続けられる負荷帯を選びます。" });
  }
  if(/ダイエット|引き締め|減量|体重/.test(goal) && a.count >= 3){
    out.push({ level: "goal", text:
      "減量・体脂肪の変化は食事全体と日常活動量の影響が大きく、筋トレは筋力・筋量の維持に役立ちます。休憩時間だけを短くするのではなく、継続できる総運動量を優先します。" });
  }
  if(/膝|腰|肩/.test(goal)){
    out.push({ level: "goal", text:
      "痛みがある場合の許容範囲は部位や病態で異なるため、一律の痛み数値だけでは決めません。運動中の増悪、終了後から翌日の反応、神経症状や腫れなどを見ながら負荷を調整します。" });
  }

  /* --- 頻度 --- */
  if(a.gap !== null && a.gap >= 21){
    out.push({ level: "habit", text:
      "前回から" + a.gap + "日空いています。前回の重量をそのまま再現することを優先せず、ウォームアップで動作・余力・痛みの有無を確認して当日の負荷を決めます。" });
  }else if(a.gap !== null && a.gap <= 2 && a.pain < 4){
    out.push({ level: "habit", text:
      "前回から" + a.gap + "日と間隔が短いため、同じ部位を高強度で行う場合は筋肉痛・疲労・パフォーマンス低下が残っていないかを確認して内容を調整します。" });
  }

  if(!out.length){
    out.push({ level: "progress", text:
      "大きな問題は出ていません。次回はフォーム・可動域・本人のきつさ・痛みの有無をそろえて比較できるようにし、必要に応じて重量・回数・セット数のいずれかを段階的に調整します。" });
  }
  return out.slice(0, 4);
}

/* stop: 運動中止/医療確認を優先、careful: 症状・疲労を見ながら調整、ok: 通常進行 */
export function safetyLevel(clientId){
  const a = assess(clientId);
  if(!a) return "ok";
  if(a.urgentFlags?.length || a.pain >= 7 || a.flags.includes("発熱")) return "stop";
  if(a.flags.length || a.pain >= 4 || a.rpe >= 9) return "careful";
  return "ok";
}

/* 本人に送る文面用。1〜2文、専門用語を避けて短く。 */
export function lineAdvice(clientId){
  const list = clientAdvice(clientId);
  const safety = list.find(x => x.level === "safety");
  if(safety) return [safety.text];
  return list.slice(0, 2).map(x => x.text);
}
