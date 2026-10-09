/* 記録からトレーニングの助言を組み立てる。
   方針は healthcare-rehabilitation-advisor の安全基準に合わせている。
   - 安全が先。痛み・神経症状・全身症状があれば、負荷の話より受診と中止基準を出す
   - 診断名は付けない。「可能性」と「確認しましょう」で止める
   - 高齢・有痛・術後は保守的に。進めるのは安全が確認できたときだけ */

import { BODYWEIGHT, num, sessionVolume } from "../core/model.js?v=21";
import { musclesForExercise } from "../core/muscles.js?v=21";
import * as store from "../core/store.js?v=21";

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
      "直近のRPEが" + a.rpe + "と高めです。限界近くが続くと回復が追いつかず、伸びが止まります。"
      + "次回は同じ重量で動作をそろえ、余裕が2回残る感覚に戻してから増やしてください。" });
  }

  const stalled = a.trends.filter(t => t.state === "stall");
  if(stalled.length){
    const t = stalled[0];
    out.push({ level: "progress", text:
      t.name + "が" + t.same + "回続けて" + t.text + "で止まっています。"
      + (t.body
        ? "自重種目は回数を2回ずつ伸ばし、頭打ちになったら下ろす動作を3秒かけます。"
          + "同じ重さでも筋肉が力を出している時間が延びるぶん刺激が上がります。"
        : "回数を先に2回増やし、全セットで揃ってから2.5kg上げる順番が安全です（重量と回数を交互に伸ばす進め方）。"
          + "それでも動かないときは、総量が足りていないのでセットを1つ足します。") });
  }

  const dropped = a.trends.filter(t => t.state === "down");
  if(dropped.length && a.pain < 4){
    out.push({ level: "progress", text:
      dropped[0].name + "が前回より落ちています。筋力そのものより、睡眠・間隔・前回の疲労が残っているかで変動します。"
      + "戻しにいかず同じ重さで2回そろえてから進めるほうが、結果的に早く戻ります。" });
  }

  const rising = a.trends.filter(t => t.state === "up");
  if(rising.length >= 2 && a.pain < 4 && a.rpe < 9){
    out.push({ level: "progress", text:
      rising.slice(0, 2).map(t => t.name).join("・") + "が伸びています。"
      + "重量が上がる時期は神経系の適応が先に進み、フォームが追いつかないことがあります。"
      + "同じ重さで動作をそろえる回を1回挟むと、そのあとの伸びが続きやすくなります。" });
  }

  /* --- 部位の偏り --- */
  const { 押す: push, 引く: pull, 下半身: lower, 体幹: core } = a.counts;
  if(push >= 2 && pull === 0){
    out.push({ level: "balance", text:
      "直近3回は押す種目が中心で、引く種目が入っていません。押す動作が続くと肩が前に出た姿勢に寄り、"
      + "肩の前側が詰まりやすくなります。ラットプルダウンかローイングを1種目足して前後を揃えてください。" });
  }else if(pull >= 2 && push === 0){
    out.push({ level: "balance", text:
      "直近3回は引く種目が中心です。押す種目を1つ入れると、肩甲骨を寄せる働きと前に出す働きが両方使えます。" });
  }
  if(lower === 0 && (push + pull) >= 2){
    out.push({ level: "balance", text:
      "直近3回は上半身が中心です。下半身は1種目あたりの動員される筋量が大きく、同じ時間でも消費と代謝への効果が出やすいので1種目入れてください。" });
  }
  if(core === 0 && a.count >= 3){
    out.push({ level: "balance", text:
      "体幹種目が入っていません。体幹は力を出す土台で、ここが保てないとスクワットやデッドリフトで腰が丸まります。プランク系を1種目加えてください。" });
  }

  /* --- 目標との整合 --- */
  if(/筋肥大|大きく|BIG3|重量/.test(goal) && a.repAvg >= 14){
    out.push({ level: "goal", text:
      "目標は筋肥大・重量ですが、直近は平均" + a.repAvg + "回と高回数寄りです。"
      + "筋肉を大きくする刺激は、限界の2回手前まで追い込める重さで最も出ます。8〜12回で限界が来る重量に寄せてください。" });
  }
  if(/ダイエット|引き締め|減量|体重/.test(goal) && a.count >= 3){
    out.push({ level: "goal", text:
      "体組成は1回の強度より、週あたりの総量と1日の活動量で決まります。"
      + "種目数を保ったまま休憩を60〜90秒に詰めると、同じ時間で総量を増やせます。筋量を保つことが基礎代謝の維持につながります。" });
  }
  if(/膝|腰|肩/.test(goal)){
    out.push({ level: "goal", text:
      "痛む関節そのものを休めるより、周りの筋を痛みのない範囲で使い続けるほうが回復は早いとされています。"
      + "痛みは運動中3/10まで、翌日に持ち越さないことを目安に。それを超えたら中止して様子を見てください。" });
  }

  /* --- 頻度 --- */
  if(a.gap !== null && a.gap >= 21){
    out.push({ level: "habit", text:
      "前回から" + a.gap + "日空いています。筋力は数週間では大きく落ちませんが、動作の慣れと結合組織の耐性が先に落ちます。"
      + "初回は前回の7割から入り、翌日の張りを見てから戻してください。" });
  }else if(a.gap !== null && a.gap <= 2 && a.pain < 4){
    out.push({ level: "habit", text:
      "前回から" + a.gap + "日と間隔が詰まっています。同じ部位の回復には48〜72時間かかるので、部位を分けるか軽めの回にしてください。" });
  }

  if(!out.length){
    out.push({ level: "progress", text:
      "大きな問題は出ていません。伸ばすときは重量と回数を同時に上げず、どちらか一方だけにすると、効いた要因が分かります。" });
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
