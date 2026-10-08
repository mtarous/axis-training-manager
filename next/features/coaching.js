/* 記録からトレーニングの助言を組み立てる。
   方針は healthcare-rehabilitation-advisor の安全基準に合わせている。
   - 安全が先。痛み・神経症状・全身症状があれば、負荷の話より受診と中止基準を出す
   - 診断名は付けない。「可能性」と「確認しましょう」で止める
   - 高齢・有痛・術後は保守的に。進めるのは安全が確認できたときだけ */

import { BODYWEIGHT, num, sessionVolume } from "../core/model.js";
import { musclesForExercise } from "../core/muscles.js";
import * as store from "../core/store.js";

/* 受診を優先すべき兆候。メモに出ていたら拾う。 */
const RED_FLAGS = [
  [/しびれ|痺れ/, "しびれ"],
  [/夜間痛|夜中.*痛|眠れ.*痛/, "夜間の痛み"],
  [/発熱|熱が/, "発熱"],
  [/めまい|眩暈/, "めまい"],
  [/胸痛|胸が苦|動悸/, "胸の症状"],
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
  const flags = RED_FLAGS.filter(([re]) => re.test(text)).map(([, label]) => label);

  const vol = Math.round(sessionVolume(last));
  const prevVol = list[1] ? Math.round(sessionVolume(list[1])) : 0;

  return {
    client, last, count: list.length, trends, counts, gap, flags,
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

  /* --- 安全が先。ここに当たったら負荷の話はしない --- */
  if(a.flags.length){
    out.push({ level: "safety", text:
      a.flags.join("・") + "の記載があります。運動より受診の確認を優先してください。"
      + "症状が続く・強くなる場合は医療機関への受診をお願いします。再開は症状が落ち着いてから、痛みの出ない範囲で。" });
  }
  if(a.pain >= 7){
    out.push({ level: "safety", text:
      "痛みが" + a.pain + "/10と強く出ています。次回は負荷を上げず、痛みの出ない可動域と姿勢の確認に充ててください。"
      + "安静時の痛みや夜間痛があれば受診をお勧めします。" });
  }else if(a.pain >= 4){
    out.push({ level: "safety", text:
      "痛みが" + a.pain + "/10あります。重量は据え置き、痛みの出る角度を避けた可動域で行ってください。"
      + "運動中は3/10を超えない、翌日に持ち越さないことを目安に。" });
  }
  if(out.some(x => x.level === "safety") && a.flags.length) return out.slice(0, 2);

  /* --- 負荷の掛かり方 --- */
  if(a.rpe >= 9){
    out.push({ level: "load", text:
      "直近のRPEが" + a.rpe + "と高めです。次回は同じ重量で動作の質をそろえ、回復の具合を確かめてから増やしてください。" });
  }

  const stalled = a.trends.filter(t => t.state === "stall");
  if(stalled.length){
    const t = stalled[0];
    out.push({ level: "progress", text:
      t.name + "が" + t.same + "回続けて" + t.text + "で止まっています。"
      + (t.body
        ? "回数を2回ずつ伸ばすか、動作を遅くして負荷を上げる方法があります。"
        : "まず回数を2回増やし、それが揃ったら2.5kg上げる順番が安全です。"
          + "それでも動かなければ、セット数を1つ増やすか、動作速度を落として刺激を変えてみてください。") });
  }

  const dropped = a.trends.filter(t => t.state === "down");
  if(dropped.length && a.pain < 4){
    out.push({ level: "progress", text:
      dropped[0].name + "が前回より落ちています。疲労・睡眠・間隔のどれが効いているか確認し、"
      + "無理に戻さず前回と同じ負荷で2回そろえてから進めてください。" });
  }

  const rising = a.trends.filter(t => t.state === "up");
  if(rising.length >= 2 && a.pain < 4 && a.rpe < 9){
    out.push({ level: "progress", text:
      rising.slice(0, 2).map(t => t.name).join("・") + "が伸びています。"
      + "伸びが続くときほどフォームが崩れやすいので、次回は同じ重量で動作の質を確認する回を挟むと定着します。" });
  }

  /* --- 部位の偏り --- */
  const { 押す: push, 引く: pull, 下半身: lower, 体幹: core } = a.counts;
  if(push >= 2 && pull === 0){
    out.push({ level: "balance", text:
      "直近3回は押す種目が中心で、引く種目が入っていません。肩の前側に負担が寄りやすいので、"
      + "ラットプルダウンやローイングを1種目足すとバランスが取れます。" });
  }else if(pull >= 2 && push === 0){
    out.push({ level: "balance", text:
      "直近3回は引く種目が中心です。押す種目を1つ入れると前後のバランスが整います。" });
  }
  if(lower === 0 && (push + pull) >= 2){
    out.push({ level: "balance", text:
      "直近3回は上半身が中心です。下半身は使う筋量が大きく、体力づくりにも効率が良いので1種目入れてみてください。" });
  }
  if(core === 0 && a.count >= 3){
    out.push({ level: "balance", text:
      "体幹種目が入っていません。プランクなど1種目加えると、他の種目で姿勢が安定しやすくなります。" });
  }

  /* --- 目標との整合 --- */
  if(/筋肥大|大きく|BIG3|重量/.test(goal) && a.repAvg >= 14){
    out.push({ level: "goal", text:
      "目標は筋肥大・重量ですが、直近は平均" + a.repAvg + "回と高回数寄りです。"
      + "8〜12回で限界の2回手前になる重さに寄せると、狙いに合いやすくなります。" });
  }
  if(/ダイエット|引き締め|減量|体重/.test(goal) && a.count >= 3){
    out.push({ level: "goal", text:
      "引き締めは1回あたりの強度より、週あたりの合計量と日常の活動量が効きます。"
      + "種目数を保ったまま休憩を短めにすると、同じ時間で総量を増やせます。" });
  }
  if(/膝|腰|肩/.test(goal)){
    out.push({ level: "goal", text:
      "痛みの出る動きを避けながら、周りの筋を痛みのない範囲で使うのが基本です。"
      + "痛みが強くなったときは中止して、状態を見てから再開してください。" });
  }

  /* --- 頻度 --- */
  if(a.gap !== null && a.gap >= 21){
    out.push({ level: "habit", text:
      "前回から" + a.gap + "日空いています。初回は前回の7割程度の重量から入り、"
      + "翌日の張りを見てから戻すと安全です。" });
  }else if(a.gap !== null && a.gap <= 2 && a.pain < 4){
    out.push({ level: "habit", text:
      "前回から" + a.gap + "日と間隔が詰まっています。同じ部位が続くときは、部位を変えるか軽めの回にしてください。" });
  }

  if(!out.length){
    out.push({ level: "progress", text:
      "大きな問題は出ていません。次回はフォームを優先しつつ、重量か回数のどちらか一方だけを小さく伸ばしましょう。" });
  }
  return out.slice(0, 4);
}

/* いまが「進めていい状態」か。文面の他の部分もこれに合わせる。
   stop: 受診確認が先／careful: 据え置き／ok: 進めてよい */
export function safetyLevel(clientId){
  const a = assess(clientId);
  if(!a) return "ok";
  if(a.flags.length || a.pain >= 7) return "stop";
  if(a.pain >= 4 || a.rpe >= 9) return "careful";
  return "ok";
}

/* 本人に送る文面用。1〜2文、専門用語を避けて短く。 */
export function lineAdvice(clientId){
  const list = clientAdvice(clientId);
  const safety = list.find(x => x.level === "safety");
  if(safety) return [safety.text];
  return list.slice(0, 2).map(x => x.text);
}
