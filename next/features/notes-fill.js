/* メニューから「注意点」「共有事項」「次回やること」を埋める。
   書くのは種目から導ける内容だけ。その日の様子（気づき）は作らない。
   すでに書かれている欄は上書きしない。 */

import { BODYWEIGHT, num, sessionSetCount, summarizeSets } from "../core/model.js?v=21";
import { musclesForExercise } from "../core/muscles.js?v=21";
import { targetsForSession } from "../core/stats.js?v=21";
import * as store from "../core/store.js?v=21";

/* 種目ごとのフォーム・安全の要点。名前は表記ゆれがあるので当たり判定で持つ。 */
const CUES = [
  [/加圧/,
   "加圧は静脈還流を制限して低負荷でも代謝ストレスを高める手段。しびれ・皮膚色の変化・拍動感が出たら即解除。高血圧・血栓既往・妊娠中は行わない"],

  [/スクワット|ハック|レッグプレス/,
   "足関節背屈と股関節屈曲の可動域が足りないと腰椎で代償する。脛骨の前傾と体幹の前傾を平行に保ち、膝はつま先と同じ面で動かす"],
  [/ワイドスクワット|ゴブレット/,
   "開き幅を広げるほど内転筋群の関与が増える。骨盤が後傾して腰椎が丸まる手前が可動域の終点"],
  [/ランジ|ステップアップ|フロントランジ/,
   "前脚の股関節伸展で立ち上がる。膝が内側に倒れる（knee-in）のは中殿筋の制御不足のサイン"],
  [/ブルガリアン|シングルレッグ|片脚|バランス/,
   "片脚支持は中殿筋の課題。立脚側の骨盤が落ちる（トレンデレンブルグ）なら重量より支持性を先に整える"],

  [/デッドリフト|RDL|ルーマニアン|ヒップヒンジ|グッドモーニング/,
   "股関節屈曲が主、腰椎は中間位で固定。バーは足部中央の重心線上を通す。腰椎が丸まる直前が可動域の終点"],
  [/ヒップスラスト|ヒップリフト|グルート/,
   "骨盤をやや後傾、肋骨を下げて腰椎の過伸展を防ぐ。トップで大殿筋を1秒保持すると股関節伸展の出力が出る"],
  [/バックキック/,
   "股関節伸展の可動域は約15°。それ以上は腰椎の代償なので、挙げる高さより臀部の収縮で判断する"],

  [/ベンチ|チェストプレス|ダンベルプレス/,
   "肩甲骨は下制＋内転で固定。肩峰下のスペースが保たれる。肘は体幹に対し45〜75°、真横に開くと肩前面の負担が増える"],
  [/フライ/,
   "肩関節水平内転の単関節種目。肘角度を固定し、伸張位での過度な水平外転は関節包前面の負担になる"],
  [/プッシュアップ|腕立て/,
   "閉鎖性運動連鎖で肩甲骨が動く。トップで前鋸筋を使い切る（protraction）と肩甲骨の安定に働く"],

  [/ラット|プルダウン|懸垂|チンニング/,
   "広背筋は上腕骨の内転・伸展。肘で引くより『肩を下げる』意識が先。肩甲骨下制が入ってから引くと背部に乗る"],
  [/ロー$|ロウ|ベントオーバー|インクラインダンベルロ/,
   "肩甲骨内転が主。胸椎が丸いままだと僧帽筋上部が優位になるので、胸椎伸展を先につくる"],

  [/ショルダープレス|アーノルド/,
   "挙上90°以上は肩甲骨の上方回旋が必須。すくみが出る高さが現状の可動域の上限"],
  [/サイドレイズ|フロントレイズ|リアレイズ/,
   "三角筋中部は肩甲骨面（前方30°）での外転で働く。小指側を上げすぎると内旋位になり肩峰下が狭くなる"],

  [/カール/,
   "肘は体側で固定。肩関節が屈曲すると上腕二頭筋長頭の張力が逃げる。回外位で収縮が強まる"],
  [/トライセプス|キックバック|プレスダウン|フレンチ/,
   "長頭は肩関節伸展も担う。肘の位置が動くと長頭の関与が落ちるので、上腕を固定したまま伸展する"],

  [/レッグエクステンション/,
   "終末伸展域で膝蓋大腿関節の圧が上がる。膝前面に痛みが出るときは可動域を0〜60°に制限する"],
  [/レッグカール/,
   "ハムストリングは股関節伸展も担う。骨盤が前傾すると張力が逃げるため、骨盤を固定して膝屈曲だけを出す"],
  [/カーフ|つま先立ち/,
   "腓腹筋は膝伸展位、ヒラメ筋は膝屈曲位で優位。狙いに合わせて膝の角度を使い分ける"],

  [/プランク|デッドバグ|バードドッグ|ベアマーチ/,
   "脊柱中間位の保持が課題。腰椎前弯が残ると腹横筋より脊柱起立筋が優位になる。呼吸を止めない"],
  [/クランチ|腹筋|アブ|ロシアン/,
   "腰椎屈曲が主動作。頸椎を強く引き込むと胸鎖乳突筋が優位になるので、視線はやや斜め上に置く"],
  [/サイドプランク/,
   "腹斜筋と中殿筋の等尺性課題。骨盤が落ちる・捻れるのは保持時間が長すぎるサイン"],
  [/バックエクステンション/,
   "胸椎伸展で起こす。腰椎だけで反ると椎間関節の圧が上がるため、反らす高さより伸展の分散を見る"],

  [/ジャンプ|ホップ|バウンディング|ボックス|スケーター/,
   "着地は股関節から吸収する。膝外反が出る、音が大きくなるのは減速能力の限界なので本数を切る"],
  [/バーピー|マウンテン/,
   "全身の連続動作で疲労とともに腰椎が丸まりやすい。フォームが崩れた時点が実質的な終点"],
  [/マーチ|腿上げ|ニードライブ|壁押し/,
   "立脚側の骨盤を水平に保つ。遊脚側が落ちるのは中殿筋の出力不足。テンポより姿勢を優先する"],

  [/ポールリラクゼーション|ストレッチ|リラクゼーション/,
   "圧は筋腹に当てる。骨突起と神経の走行部（腓骨頭・肘内側など）は避ける。強い痛みは逆に筋緊張を上げる"]
];

export function cuesFor(name){
  const n = String(name || "");
  return CUES.filter(([re]) => re.test(n)).map(([, cue]) => cue);
}

/* そのメニューの中心がどこか */
function focusOf(session){
  const parts = new Set();
  session.exercises.forEach(e => musclesForExercise(e.name).forEach(p => parts.add(p)));
  const lower = ["大腿四頭筋", "臀筋", "ハム", "ふくらはぎ"].some(p => parts.has(p));
  const upper = ["胸", "肩", "三頭", "広背筋", "二頭"].some(p => parts.has(p));
  const core = ["腹筋", "脊柱起立筋"].some(p => parts.has(p));
  if(lower && upper) return "全身";
  if(lower) return "下半身中心";
  if(upper) return "上半身中心";
  if(core) return "体幹中心";
  return "";
}

/* いちばん重い種目。共有事項の「主な種目」に使う。 */
function mainExercise(session){
  let best = null, bestLoad = -1;
  session.exercises.forEach(e => {
    const load = e.sets.reduce((a, s) =>
      a + (String(s.weight) === BODYWEIGHT ? 0 : num(s.weight) * num(s.reps)), 0);
    if(load > bestLoad){ bestLoad = load; best = e }
  });
  return best || session.exercises[0] || null;
}


/* メニューから読める「出やすい傾向」。
   実際に見ていないことを断定しないため、「〜になりやすい」の形で書く。 */
function tendencies(session){
  const names = session.exercises.map(e => e.name).join(" ");
  const sets = session.exercises.flatMap(e => e.sets);
  const reps = sets.map(s => s.reps).filter(Boolean);
  const avgRep = reps.length ? reps.reduce((a, b) => a + b, 0) / reps.length : 0;
  const bodyRatio = sets.length
    ? sets.filter(s => String(s.weight) === BODYWEIGHT).length / sets.length : 0;
  const focus = focusOf(session);
  const out = [];

  if(/加圧/.test(names))
    out.push("加圧は低負荷でも追い込めるぶん、主観的なきつさが実際の関節負荷より先に来る。きつさではなく回数で止める構成");
  if(bodyRatio >= 0.6)
    out.push("自重中心のため、重量ではなく疲労で支持性が落ちる。終盤は片脚種目で骨盤が落ちやすく、左右差が出るなら中殿筋の持久性の差を見る");
  if(avgRep >= 15)
    out.push("高回数中心で代謝ストレスが主の刺激。終盤はフォームより先に呼吸が乱れやすいので、呼吸が続く範囲が実質の上限");
  else if(avgRep > 0 && avgRep <= 8)
    out.push("低回数・高強度帯。筋肥大より神経系の適応が先に出る時期で、動作の再現性が成果を分ける");
  if(/ブルガリアン|ランジ|ステップアップ|片脚|シングルレッグ/.test(names))
    out.push("片脚種目は伸張性の負荷が大きく、翌日から翌々日に張りが出やすい。次回の間隔は48〜72時間を確保したい");
  if(focus === "下半身中心")
    out.push("下半身中心の構成で、動員される筋量が大きいぶん全身の疲労感が出やすい。水分と補食で回復が変わる");
  if(/ジャンプ|バウンディング|ボックス|スケーター/.test(names))
    out.push("跳躍系は疲労とともに着地の減速能力から落ちる。接地音が大きくなった時点が本数の上限");
  if(session.exercises.length >= 7)
    out.push(session.exercises.length + "種目と多めの構成。後半ほど集中が落ちるため、重要な種目を前半に置けているか確認したい");

  return out.slice(0, 2);
}

/* 気づき：すでに書かれている内容は残し、傾向を後ろに足す */
export function insightFor(session){
  const t = tendencies(session);
  if(!t.length) return "";
  return t.map(x => "・" + x).join("\n");
}

/* 注意点：この回の種目から導ける要点を重複なく並べる */
export function cautionFor(session){
  const seen = new Set();
  session.exercises.forEach(e => cuesFor(e.name).forEach(c => seen.add(c)));
  if(!seen.size) return "";
  return [...seen].slice(0, 4).map(c => "・" + c).join("\n");
}

/* 共有事項：本人が読む欄。何を狙った構成かを、事実と理由で短く伝える */
export function shareFor(session){
  const focus = focusOf(session);
  const main = mainExercise(session);
  const names = session.exercises.map(e => e.name).join(" ");

  const head = "本日は" + (focus ? focus + "の" : "") +
    session.exercises.length + "種目・" + sessionSetCount(session) + "セットでした。" +
    (main ? "中心は" + main.name + "（" + summarizeSets(main.sets) + "）です。" : "");

  let why = "";
  if(focus === "下半身中心")
    why = "下半身は一度に使う筋肉の量が多く、体力づくりと代謝の両方に効率よく効きます。";
  else if(focus === "上半身中心")
    why = "押す動きと引く動きを組み合わせると、肩まわりが前後どちらかに偏らずに済みます。";
  else if(focus === "全身")
    why = "上半身と下半身を一度に扱う構成です。全身をまとめて行うほうが、週あたりの頻度を保ちやすくなります。";
  else if(focus === "体幹中心")
    why = "体幹は力を出すときの土台です。ここが保てると、他の種目で腰が丸まりにくくなります。";

  const tip = /プランク|デッドバグ|バードドッグ/.test(names)
    ? "体幹種目は動かさずに保つのが目的なので、呼吸を止めないことが大切です。"
    : /加圧/.test(names)
      ? "加圧は軽い重さでも効かせられる方法です。しびれや強い張りを感じたらすぐ教えてください。"
      : "";

  return [head, why, tip].filter(Boolean).join("");
}

/* 次回やること：その回の内容から出る目安 */
export function nextFor(session){
  const list = targetsForSession(session, 3);
  if(!list.length) return "";
  return list.map(t => "・" + t.name + "：" + t.text).join("\n");
}

/* 空いている欄だけを埋める。書かれているものは触らない。 */
export function fillEmptyNotes(sessions){
  let filled = 0;
  Object.values(sessions || {}).forEach(s => {
    if(!s?.exercises?.length) return;
    const auto = new Set(Array.isArray(s.notesAuto) ? s.notesAuto : []);
    let touched = false;

    const addInsight = s.source === "legacy" ? "" : insightFor(s);
    if(addInsight && !String(s.notes.insight || "").includes(addInsight.split("\n")[0])){
      s.notes.insight = [String(s.notes.insight || "").trim(), addInsight].filter(Boolean).join("\n");
      auto.add("insight");
      touched = true;
    }
    if(!String(s.notes.caution || "").trim()){
      const v = cautionFor(s);
      if(v){ s.notes.caution = v; auto.add("caution"); touched = true }
    }
    if(!String(s.notes.share || "").trim()){
      const v = shareFor(s);
      if(v){ s.notes.share = v; auto.add("share"); touched = true }
    }
    if(!String(s.notes.next || "").trim()){
      const v = nextFor(s);
      if(v){ s.notes.next = v; auto.add("next"); touched = true }
    }
    if(touched){ s.notesAuto = [...auto]; filled += 1 }
  });
  return filled;
}

/* 何件埋まるか、書き込む前に数える */
export function countEmpty(sessions){
  return Object.values(sessions || {}).filter(s =>
    s?.exercises?.length && (
      !String(s.notes.caution || "").trim() ||
      !String(s.notes.share || "").trim() ||
      !String(s.notes.next || "").trim() ||
      (s.source !== "legacy" && insightFor(s) && !String(s.notes.insight || "").includes(insightFor(s).split("\n")[0]))
    )).length;
}
