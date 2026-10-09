/* LINE向けの専門フィードバック。
   記録された種目・負荷・RPE・痛み・目標から、解剖/運動学・生体力学・運動生理・栄養・ケア・セルフ運動を組み立てる。
   診断はせず、安全上の懸念がある場合は負荷提案より受診・症状確認を優先する。 */
import * as store from "../core/store.js?v=19";
import { clientSummary } from "../core/stats.js?v=19";
import { musclesOfSession } from "../core/muscles.js?v=19";
import { assess, safetyLevel } from "./coaching.js?v=19";

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
  const parts=[];
  const push=has(s,/ベンチ|チェスト|プッシュアップ|フライ/i);
  const pull=has(s,/ラット|プルダウン|懸垂|チンニング|ロー|ロウ|ワンハンド/i);
  const squat=has(s,/スクワット|レッグプレス|ブルガリアン|ランジ|ステップアップ|片脚/i);
  const hinge=has(s,/デッド|RDL|ルーマニアン|ヒップヒンジ|ヒップスラスト/i);
  const shoulder=has(s,/ショルダー|サイドレイズ|リアレイズ|フロントレイズ/i);
  if(push) parts.push("押す動作では大胸筋・三角筋前部・上腕三頭筋が協働し、肩関節の水平内転/屈曲と肘伸展を行います。");
  if(pull) parts.push("引く動作では広背筋に加え、僧帽筋中下部・菱形筋などが肩甲骨の下制/内転を支えます。");
  if(squat) parts.push("下半身では大臀筋・大腿四頭筋・ハムストリングスを使い、股関節と膝関節の伸展を協調させます。");
  else if(hinge) parts.push("後面では大臀筋・ハムストリングス・脊柱起立筋を使い、股関節伸展を中心に力を発揮します。");
  if(shoulder&&!push) parts.push("肩では三角筋と肩甲帯周囲筋が協働し、上腕挙上に合わせて肩甲骨を上方回旋させます。");
  if(parts.length>=2) return "複数関節を使う全身性の構成です。"+parts.slice(0,3).join("");
  if(parts.length) return parts[0];
  const m=musclesOfSession(s);return m.length?`${m.slice(0,4).join("・")}を中心に刺激する構成です。`:"全身の動作を組み合わせた内容です。";
}

function biomechanics(s){
  const n=mainName(s); const pre=n?`主負荷種目の${n}では、`:"";
  if(/ブルガリアン|ランジ|片脚|ステップアップ/i.test(n)) return pre+"支持脚の足部中央に重心を保ち、膝の内側偏位と骨盤の側方傾斜を抑えることで、股関節から床反力を受けやすくなります。";
  if(/スクワット|レッグプレス/i.test(n)) return pre+"足底全体で床を捉え、膝とつま先の向きをそろえながら股関節と膝関節で負荷を分散します。腰椎だけで深さを作らないことが重要です。";
  if(/デッド|RDL|ルーマニアン|ヒップヒンジ/i.test(n)) return pre+"重心を足部中央付近に保ち、脊柱の位置を大きく変えず股関節から折りたたむことで、腰部に集中する外力モーメントを抑えやすくなります。";
  if(/ラット|プルダウン|ロー|ロウ|懸垂|ワンハンド/i.test(n)) return pre+"肩をすくめず肩甲骨の下制・内転を先に作り、その後に肘を引くと、上腕だけに頼らず背部へ張力を伝えやすくなります。";
  if(/ベンチ|チェスト|プッシュアップ/i.test(n)) return pre+"肘を真横に開きすぎず、肩甲帯を安定させたまま押すことで、肩前面に集中しやすい負担を分散できます。";
  return pre+"動作速度と可動域をそろえ、疲労時にも代償動作が増えない範囲で反復することを優先します。";
}

function physiology(s,a){
  const reps=avgReps(s);const rpe=Number(a?.rpe)||0;
  if(rpe>=9) return "主観的運動強度が高い回です。神経系と筋の疲労が残りやすいため、次回までの回復を優先し、同じ部位への高強度負荷は連日重ねない方針が適します。";
  if(reps>=15) return "高回数帯で、局所の筋持久力と代謝ストレスが大きくなりやすい構成です。フォームが崩れる前にセットを終了することが重要です。";
  if(reps>0&&reps<=6) return "低回数・高強度寄りで、筋力発揮と神経系への刺激が大きい構成です。回数を増やすより、1回ごとの動作再現性を優先します。";
  return "中程度の反復回数で、筋力と筋肥大の両方を狙いやすい構成です。限界まで毎回行かず、少し余力を残して総量を積み上げる方が継続しやすくなります。";
}

function nutrition(client){
  const goal=String(client?.goal||"");
  if(/減量|ダイエット|引き締め|体脂肪/.test(goal)) return "回復を落とさないため極端な食事制限は避け、各食でたんぱく質源を確保してください。トレーニング前後は炭水化物を完全に抜かず、水分もこまめに補給すると運動の質を保ちやすくなります。";
  if(/筋肥大|筋力|大きく|BIG3|重量/.test(goal)) return "筋力・筋量を伸ばす時期は、1日のたんぱく質を複数回の食事に分け、トレーニング前後は炭水化物も確保すると回復と次回の出力につながります。";
  return "運動後は、たんぱく質を含む食事と水分を確保してください。特定の短い時間帯だけにこだわらず、その後数時間の食事全体を整えることを優先します。";
}

function care(s,level){
  if(level!=="ok") return "痛みや違和感がある日は強いストレッチや追い込みを避け、症状が増えない範囲の軽い関節運動と日常歩行程度に留めてください。症状が増強・持続する場合は医療機関への相談を優先してください。";
  const n=mainName(s);
  if(/スクワット|ランジ|ブルガリアン|デッド|レッグ|ヒップ/i.test(n)) return "当日〜翌日は軽い歩行や股関節・足関節のゆっくりした運動で循環を促し、強い筋肉痛がある部位を無理に伸ばし切らないようにしてください。";
  return "肩・胸郭まわりは痛みのない範囲で肩甲骨をゆっくり動かし、同じ姿勢を長時間続けないことが回復の助けになります。";
}

function selfExercise(s,level){
  if(level!=="ok") return "自宅では、痛みが増えない範囲でゆっくり5〜10回の関節運動から始めてください。運動中の痛みが強くなる、しびれ・脱力などが出る場合は中止してください。";
  const n=mainName(s);
  if(/ラット|プルダウン|ロー|ロウ|ショルダー|サイドレイズ|ベンチ|チェスト/i.test(n)) return "セルフ運動は『肋骨を反らさずに壁スライド8〜10回×2セット』がおすすめです。肩甲骨と上腕の連動を確認できます。";
  if(/スクワット|ブルガリアン|ランジ|片脚|レッグプレス/i.test(n)) return "セルフ運動は『椅子からの立ち座り8〜12回×2セット』を、膝とつま先の向きをそろえて行ってください。余裕があれば片脚立ち20〜30秒も追加できます。";
  if(/デッド|RDL|ヒップヒンジ|ヒップスラスト/i.test(n)) return "セルフ運動は『壁タッチ・ヒップヒンジ10回×2セット』がおすすめです。お尻を後ろへ引き、腰ではなく股関節から曲げる感覚を確認します。";
  return "自宅では、当日使った部位を痛みのない範囲でゆっくり動かし、5〜10分程度の軽い有酸素運動を組み合わせる程度で十分です。";
}

export function professionalFeedback(clientId){
  const client=store.client(clientId);const s=clientSummary(clientId);if(!client||!s.last)return null;
  const a=assess(clientId);const level=safetyLevel(clientId);
  return {anatomy:anatomy(s.last),biomechanics:biomechanics(s.last),physiology:physiology(s.last,a),nutrition:nutrition(client),care:care(s.last,level),self:selfExercise(s.last,level),level};
}
