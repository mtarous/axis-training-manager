/* 利用者に送るLINE文面を組み立てる。
   旧アプリの professionalAdvice / professionalLine を v2 のデータで作り直したもの。
   文面はそのまま送る前提ではなく、直して使うたたき台。 */

import { musclesOfSession } from "../core/muscles.js";
import * as sched from "../core/schedule.js";
import * as store from "../core/store.js";
import { clientSummary, nextTargets } from "../core/stats.js";
import { today } from "../core/model.js";

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
  return sched.all().find(x => x.clientId === clientId && x.date >= t) || null;
}

/* 今日のポイント。痛み・RPE・負荷の増減・目標から選ぶ */
export function coachingAdvice(client){
  const s = clientSummary(client.id);
  const last = s.last;
  const goal = String(client.goal || "");
  const pain = Number(last?.pain || 0);
  const rpe = Number(last?.rpe || 0);
  const out = [];

  if(pain >= 4) out.push(`痛みが${pain}/10あるため、次回は重量を追うより、痛みの出ない可動域とフォームを優先しましょう。痛みが増える動きは避け、必要なら種目を変えます。`);
  else if(rpe >= 9) out.push(`直近のRPEが${rpe}と高めです。次回は同じ重量を基準に、フォームの再現性と回復の具合を見てから増やしましょう。`);
  else if(rpe >= 7) out.push(`直近のRPEは${rpe}で、ちょうどよい負荷です。フォームが安定していれば、次回は重量か回数のどちらか一方だけ少し伸ばすのが効率的です。`);

  if(s.delta !== null && s.delta >= 12) out.push(`直近の総負荷量は前回より約${s.delta}%増えています。伸びは良いので、次回は同じくらいの負荷で動きの質を確かめましょう。`);
  if(s.delta !== null && s.delta <= -15) out.push(`直近の総負荷量は前回より約${Math.abs(s.delta)}%低めです。疲れや体調の影響を確かめて、無理に戻さず段階的に調整しましょう。`);

  if(/ダイエット|引き締め|腹部|減量|体重/.test(goal)) out.push("引き締めは筋トレに加えて、日常の活動量と食事の継続が効きます。毎食たんぱく質を確保し、歩数を安定させると筋肉を保ちながら進めやすくなります。");
  if(/BIG3|筋肥大|重量/.test(goal)) out.push("重量よりフォームの再現性が先です。RPE7〜8（あと2〜3回できる余裕）を基準に、安定してから2.5kgずつ上げましょう。");
  if(/ゴルフ|飛距離/.test(goal)) out.push("飛距離は脚力だけでなく、股関節の伸展・回旋と体幹の安定が効きます。下半身で作った力を上半身へ伝える動きを意識しましょう。");
  if(/膝|腰|肩|痛/.test(goal)) out.push("状態を毎回確かめて、痛みや張りがある日は可動域と負荷を下げ、痛みのない範囲で使っていきましょう。");

  if(!out.length) out.push("次回もフォームを優先しながら、RPE7〜8くらいの余裕を残して、重量か回数のどちらか一つだけ少し伸ばしていきましょう。");
  return out.slice(0, 3);
}

export function lineMessage(clientId){
  const client = store.client(clientId);
  if(!client) return "";
  const s = clientSummary(clientId);
  if(!s.last) return callName(client.name) + "、本日もありがとうございました😊";

  const muscles = musclesOfSession(s.last);
  const list = nextTargets(clientId, 3);
  const targets = list.length
    ? "次回の目安です。\n" + list.map(t => "・" + t.name + "：" + t.text).join("\n")
    : "次回は今回の内容をもとに、状態を見ながら調整していきます。";

  let progress = "今回の内容を安定して行えています";
  if(s.delta !== null && s.delta >= 5) progress = `総負荷量が前回より約${s.delta}%伸びています`;
  else if(muscles.length) progress = `${muscles.slice(0, 3).join("・")}を中心にしっかり追い込めました`;

  const appt = nextAppointment(clientId);
  const dateLine = appt
    ? `次回は${jp(appt.date)} ${appt.time}〜のご予約です。ご都合は大丈夫でしょうか？`
    : "次回のご予約がまだ入っていません。ご都合の良い日時を教えてください。";

  const share = s.last.notes?.share ? "\n" + s.last.notes.share + "\n" : "";

  return `${callName(client.name)}、本日もありがとうございました😊
今回は${progress}。
${share}
${targets}

【今日のポイント】
${coachingAdvice(client)[0]}

${dateLine}
また次回もよろしくお願いします😊`;
}
