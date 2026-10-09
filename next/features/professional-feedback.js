/* LINE向けの専門フィードバック。
   記録された種目・負荷・RPE・痛み・目標から、解剖/運動学・生体力学・運動生理・栄養・ケア・セルフ運動を組み立てる。
   診断はせず、安全上の懸念がある場合は負荷提案より受診・症状確認を優先する。 */
import * as store from "../core/store.js?v=21";
import { clientSummary } from "../core/stats.js?v=21";
import { musclesOfSession } from "../core/muscles.js?v=21";
import { assess, safetyLevel } from "./coaching.js?v=21";

const has=(s,re)=>re.test((s?.exercises||[]).map(e=>e.name).join(" "));
const avgReps=s=>{const a=(s?.exercises||[]).flatMap(e=>e.sets||[]).map(x=>Number(x.reps)||0).filter(Boolean);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0};
function mainName(s){
  let best="",score=-1;
  (s?.exercises||[]).forEach(e=>{
    const weighted=(e.sets||[]).reduce((a,x)=>a+(Number(x.weight)||0)*(Number(x.reps)||0),0);
    const reps=(e.sets||[]).reduce((a,x)=>a+(Number(x.reps)||0),0);
    const v=weighted>0?weighted:reps;
    if(v>score){score=v;best=String(e.name||"")}
  });
  return best;
}

function anatomy(s){
  const n=mainName(s);
  if(/ラット|プルダウン|懸垂|チンニング|ロー|ロウ|ワンハンド/i.test(n))
    return `${n}では、腕を下へ引く動きに広背筋、肘を曲げる動きに上腕二頭筋などが関わります。肩甲骨まわりも一緒に働くことで、背中で引きやすくなります。`;
  if(/ベンチ|チェスト|プッシュアップ|フライ/i.test(n))
    return `${n}では、胸・肩の前・二の腕が連動して押す力を作ります。肩が前に出すぎないように、肩甲骨と胸郭を安定させることがポイントです。`;
  if(/スクワット|レッグプレス|ブルガリアン|ランジ|ステップアップ|片脚/i.test(n))
    return `${n}では、お尻・太もも前後を使いながら股関節と膝を一緒に伸ばします。膝だけで頑張らず、股関節も使えると動きが安定します。`;
  if(/デッド|RDL|ルーマニアン|ヒップヒンジ|ヒップスラスト/i.test(n))
    return `${n}では、お尻とハムストリングスを中心に股関節を伸ばす力を使います。腰で持ち上げず、股関節から動く感覚がポイントです。`;
  if(/ショルダー|サイドレイズ|リアレイズ|フロントレイズ/i.test(n))
    return `${n}では、肩の筋肉と肩甲骨まわりが連動します。肩をすくめず、肩甲骨が自然に動く範囲で行うと安定しやすくなります。`;
  const m=musclesOfSession(s);
  return m.length ? `${m.slice(0,4).join("・")}を中心に使う内容でした。筋肉だけでなく、関節の動きもそろえて行うことがポイントです。` : `今日は全身を使う内容でした。関節の動きをそろえながら、狙った筋肉に負荷を乗せることを意識しています。`;
}

function biomechanics(s){
  const n=mainName(s); const pre=n?`${n}では、`:"";
  if(/ブルガリアン|ランジ|片脚|ステップアップ/i.test(n)) return pre+"足裏の真ん中で体重を受け、膝とつま先の向きをそろえると、骨盤がぶれにくくなります。";
  if(/スクワット|レッグプレス/i.test(n)) return pre+"足裏全体で押し、膝とつま先の向きをそろえることで、腰や膝だけに負担が集中しにくくなります。";
  if(/デッド|RDL|ルーマニアン|ヒップヒンジ/i.test(n)) return pre+"重心を足の真ん中に保ち、お尻を後ろへ引くと、腰に頼らず股関節で力を出しやすくなります。";
  if(/ラット|プルダウン|ロー|ロウ|懸垂|ワンハンド/i.test(n)) return pre+"体を反らしすぎず、胸を軽く起こした姿勢で肘を斜め下へ引くと、反動を使わず背中へ負荷を乗せやすくなります。";
  if(/ベンチ|チェスト|プッシュアップ/i.test(n)) return pre+"手首と肘の位置をそろえ、肩がすくまない姿勢で押すと、力が逃げにくく肩前面への負担も分散しやすくなります。";
  return pre+"動作の速さと可動域をそろえ、疲れてきてもフォームが大きく崩れない範囲で行うことを優先します。";
}

function physiology(s,a){
  const reps=avgReps(s);const rpe=Number(a?.rpe)||0;
  if(rpe>=9) return "今回はかなり高い強度です。筋肉だけでなく神経系の疲労も残りやすいので、次回までの回復を優先します。";
  if(reps>=15) return "今回は高回数が中心で、筋持久力を高めやすい内容です。回数を追いすぎず、フォームが崩れる前で止めることが大切です。";
  if(reps>0&&reps<=6) return "今回は低回数・高強度寄りで、筋力を高める刺激が強い内容です。回数を増やすより、1回ごとの動きをそろえることを優先します。";
  return "今回は中くらいの回数帯で、筋力と筋量の両方を狙いやすい内容です。毎回限界まで行かず、少し余裕を残しながら続けると伸ばしやすくなります。";
}

function nutrition(client){
  const goal=String(client?.goal||"");
  if(/減量|ダイエット|引き締め|体脂肪/.test(goal)) return "減量中でも、たんぱく質と水分はしっかり確保しましょう。トレーニング前後は炭水化物を完全に抜かない方が、動きと回復を保ちやすいです。";
  if(/筋肥大|筋力|大きく|BIG3|重量/.test(goal)) return "筋力や筋量を伸ばす時期は、たんぱく質を1回にまとめず数回の食事に分けるのがおすすめです。トレーニング前後は炭水化物も取れると回復につながります。";
  return "運動後は、水分とたんぱく質を含む食事を意識してください。食事1回だけではなく、その日の食事全体を整えることが回復につながります。";
}

function care(s,level){
  if(level!=="ok") return "今日は無理に伸ばしたり追い込んだりせず、痛みや違和感が増えない範囲で軽く動く程度にしてください。症状が続く場合は受診も優先しましょう。";
  const n=mainName(s);
  if(/スクワット|ランジ|ブルガリアン|デッド|レッグ|ヒップ/i.test(n)) return "当日〜翌日は、軽い歩行や股関節・足首をゆっくり動かす程度で十分です。強い筋肉痛がある部位を無理に伸ばし切る必要はありません。";
  return "当日〜翌日は、肩や胸郭まわりを痛みのない範囲でゆっくり動かしてください。同じ姿勢が長く続かないようにするだけでも回復につながります。";
}

function selfExercise(s,level){
  if(level!=="ok") return "自宅では、痛みが増えない範囲でゆっくり5〜10回ほど動かす程度にしてください。痛みやしびれが強くなる場合は中止してください。";
  const n=mainName(s);
  if(/ラット|プルダウン|ロー|ロウ|ショルダー|サイドレイズ|ベンチ|チェスト/i.test(n)) return "壁に背中をつけて、腕をゆっくり上下する『壁スライド』を8〜10回×2セット。肩をすくめず行ってみてください。";
  if(/スクワット|ブルガリアン|ランジ|片脚|レッグプレス/i.test(n)) return "椅子からの立ち座りを8〜12回×2セット。膝とつま先の向きをそろえて行ってみてください。";
  if(/デッド|RDL|ヒップヒンジ|ヒップスラスト/i.test(n)) return "壁タッチ・ヒップヒンジを10回×2セット。お尻を後ろへ引き、腰ではなく股関節から曲げる感覚を確認してください。";
  return "自宅では、当日使った部位を痛みのない範囲で軽く動かし、5〜10分ほど歩く程度で十分です。";
}

export function professionalFeedback(clientId){
  const client=store.client(clientId);const s=clientSummary(clientId);if(!client||!s.last)return null;
  const a=assess(clientId);const level=safetyLevel(clientId);
  return {anatomy:anatomy(s.last),biomechanics:biomechanics(s.last),physiology:physiology(s.last,a),nutrition:nutrition(client),care:care(s.last,level),self:selfExercise(s.last,level),level};
}
