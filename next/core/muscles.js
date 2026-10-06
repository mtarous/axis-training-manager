/* 種目名から鍛えた部位を推定する。
   当てはまらない種目は空で返す（「全身」を返すと人体図が全部光ってしまうため）。 */

const RULES = [
  [/ベンチ|チェスト|胸|push.?up|プッシュアップ|ダンベルプレス/i, ["胸","肩","三頭"]],
  [/ラット|ロー|ロウ|背中|row|pull.?down|プルダウン|懸垂|チンニング/i, ["広背筋","二頭"]],
  [/スクワット|レッグプレス|ブルガリアン|ランジ|lunge/i, ["大腿四頭筋","臀筋","ハム"]],
  [/デッド|rdl|ルーマニアン|ヒップヒンジ|ヒップスラスト|ヒップリフト/i, ["臀筋","ハム","脊柱起立筋"]],
  [/レッグエクステンション/i, ["大腿四頭筋"]],
  [/レッグカール/i, ["ハム"]],
  [/ショルダー|サイドレイズ|ラテラル|shoulder|raise/i, ["肩"]],
  [/トライセプ|三頭|キックバック|プレスダウン|ディップス/i, ["三頭"]],
  [/クランチ|腹|abs|プランク|plank|アブ|マウンテンクライマー/i, ["腹筋"]],
  [/バックエクステンション/i, ["脊柱起立筋","臀筋"]],
  [/カーフ|calf/i, ["ふくらはぎ"]],
  [/ジャンプ|ホップ|jump|hop|バウンディング/i, ["大腿四頭筋","臀筋","ふくらはぎ"]],
  [/マーチ|腿上げ|ニードライブ|ステップアップ/i, ["大腿四頭筋","臀筋"]],
  [/バックキック|片脚バランス|シングルレッグバランス/i, ["臀筋","ハム"]],
  [/バードドッグ|ベアマーチ|体幹/i, ["腹筋","脊柱起立筋","臀筋"]],
  [/バーピー/i, ["胸","肩","大腿四頭筋","臀筋"]]
];

export function musclesForExercise(name){
  const n = String(name || "");
  const out = new Set();
  RULES.forEach(([re, parts]) => { if(re.test(n)) parts.forEach(p => out.add(p)) });
  // 「カール」は二頭だが「レッグカール」はハム。先に除いてから判定する。
  if(/カール|curl/i.test(n) && !/レッグカール|leg.?curl/i.test(n)) out.add("二頭");
  return [...out];
}

export function musclesOfSession(session){
  const out = new Set();
  (session?.exercises || []).forEach(e => musclesForExercise(e.name).forEach(m => out.add(m)));
  return [...out];
}
