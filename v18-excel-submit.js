/* AXIS v18 提出用Excel
   元の「トレーニング管理」ブックと同じ7シート構成（ダッシュボード / 入力 / 記録 /
   カルテ / LINE文面 / グラフ / 種目リスト）を、アプリの記録から組み立てて書き出す。
   記録シートだけが実データで、他シートは元ブックと同じ数式で自動集計する。 */
(function(){
"use strict";

/* 元ブックの種目マスタ（提出用Excelの種目リストはここを基準に出す） */
const MASTER_EXERCISES=["ベンチプレス", "インクラインベンチプレス", "ダンベルベンチプレス", "チェストプレス", "ダンベルフライ", "ケーブルフライ", "チェストフライ", "プッシュアップ", "ワイドプッシュアップ", "ナロープッシュアップ", "デクラインプッシュアップ", "ナローベンチプレス", "スクワット", "スミススクワット", "ワイドスクワット", "ハックスクワット", "ゴブレットスクワット", "フロントスクワット", "ボックススクワット", "シシースクワット", "ブルガリアンスクワット", "シングルレッグスクワット", "ステップアップ", "つま先スクワット", "片脚スクワット", "ランジ", "リバースランジ", "レッグプレス", "レッグエクステンション", "レッグカール", "カーフレイズ", "シングルレッグカーフレイズ", "ヒップスラスト", "ヒップリフト", "片脚ヒップリフト", "グルートブリッジ", "デッドリフト", "ルーマニアンデッドリフト", "スティフレッグデッドリフト", "シングルレッグRDL", "グッドモーニング", "ラットプルダウン", "チンニング", "インクラインダンベルロウ", "懸垂", "シーテッドロー", "ワンハンドダンベルロー", "バーベルロー", "インバーテッドロー", "スキャプラプルアップ", "ストレートアームプルダウン", "ショルダープレス", "ダンベルショルダープレス", "アーノルドプレス", "サイドレイズ", "フロントレイズ", "リアレイズ", "Yレイズ", "Tレイズ", "Wレイズ", "アームカール", "ダンベルカール", "ハンマーカール", "バーベルカール", "コンセントレーションカール", "リバースカール", "トライセプスエクステンション", "ケーブルプレスダウン", "フレンチプレス", "ディップス", "キックバック", "バックエクステンション", "クランチ", "シットアップ", "レッグレイズ", "プランク", "サイドプランク", "デッドバグ", "バードドッグ", "アブローラー", "ロシアンツイスト", "Vシット", "アブクラッシャー", "ジャンプスクワット", "タックジャンプ", "スプリットジャンプ", "バウンディング", "ボックスジャンプ", "デプスジャンプ", "スケータージャンプ", "ラテラルホップ", "その場腿上げ(片足ずつ交互)", "メディシンボールスロー", "メディシンボールチェストパス", "ローテーションスロー", "バーピー", "マウンテンクライマー", "ジャンピングジャック", "スキャプラプッシュアップ", "バンドプルアパート", "クラムシェル", "モンスターウォーク", "ヒップエアプレーン", "ワールドグレイテストストレッチ", "胸椎ローテーション", "キャットカウ", "ディープスクワットホールド", "スプリットスタンス ローテーション", "片脚スタンス 体幹回旋", "スケータージャンプ＋上体回旋", "リストカール", "リバースリストカール", "リスト回旋", "ベンチプレス（加圧）", "スクワット（加圧）", "スミススクワット（加圧）", "ヒップスラスト（加圧）", "ブルガリアンスクワット（加圧）", "ワイドスクワット（加圧）", "ヒップヒンジ", "ベアマーチ", "ニードライブ", "その場Aマーチ", "壁押しマーチ", "バックキック", "シングルレッグバランス", "ポールリラクゼーション", "腹筋サーキット"];
const SHEET_LAST=3000;   /* 元ブックの参照範囲に合わせる */
const INPUT_ROWS=10;     /* 入力シートのコピー用行数 M7:T16 */

function serial(d){
  const t=d instanceof Date?d:new Date(String(d).replace(/-/g,"/"));
  if(!(t instanceof Date)||isNaN(t)) return null;
  return Math.round((Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())-Date.UTC(1899,11,30))/86400000);
}
function dateCell(v){
  const s=serial(v);
  return s===null?{t:"s",v:String(v||"")}:{t:"n",v:s,z:"yyyy/mm/dd"};
}
function f(formula){return {t:"s",f:String(formula).replace(/^=/,"")}}
function numOrBlank(v){
  if(v===null||v===undefined||String(v).trim()==="") return null;
  if(String(v).includes("自重")) return {t:"s",v:"自重"};
  const x=Number(v);
  return Number.isFinite(x)?{t:"n",v:x}:{t:"s",v:String(v)};
}
/* アプリの達成ステータスを元ブックの ✅ / ❌ に寄せる */
function achievedMark(v){
  const s=String(v||"").trim();
  if(s==="✅"||s==="❌") return s;
  if(!s) return "";
  return /完了|良好|達成/.test(s)?"✅":"❌";
}
/* 「青木　理沙」→「青木さん」 LINE文面の呼びかけ用 */
function shortName(name){
  const s=String(name||"").trim();
  if(/さん$|様$|夫婦$/.test(s)) return s;
  const head=s.split(/[\s　]+/)[0];
  return (head||s)+"さん";
}
/* 目標から LINE文面の一文を選ぶ（元ブックは利用者ごとに固定文が入っていた） */
function goalLine(goal){
  const g=String(goal||"");
  if(/引き締め|腹部|ダイエット|痩せ|減量/.test(g)) return "お腹まわりの引き締めも着実に進んでいます。";
  if(/筋肥大|BIG3|重量|飛距離/.test(g)) return "狙った部位にしっかり効かせられています。";
  if(/姿勢|フォーム/.test(g)) return "フォームの再現性が上がってきています。";
  if(/膝|痛み|リハビリ/.test(g)) return "痛みの出にくい動き方が身についてきています。";
  return "狙った動きが安定してきています。";
}

function clientsWithGoals(){
  const list=typeof clientList==="function"?clientList():[];
  return list.map(c=>({
    name:c.name,
    goal:(typeof META!=="undefined"&&META.goals?.[c.name])||c.goal||""
  }));
}

/* ---- 各シート ---- */
function sheetRecords(rows){
  const aoa=[
    ["📝 記録（入力はこのシートだけ）"],
    ["1行=1種目。セッション後に下へ追記するだけで、他のシートは自動で更新されます。"],
    [],
    ["日付","クライアント","種目","重量kg","回数","セット","達成","メモ"]
  ];
  rows.forEach(r=>aoa.push([
    dateCell(r.date), String(r.client||""), String(r.exercise||""),
    numOrBlank(r.weight), numOrBlank(r.reps), numOrBlank(r.sets),
    achievedMark(r.achieved), String(r.memo||"")
  ]));
  return XLSX.utils.aoa_to_sheet(aoa,{cellDates:false});
}

function sheetDashboard(cs){
  const last=4+cs.length;                 /* データ最終行 */
  const aoa=[
    ["📊 クライアント管理ダッシュボード（自動集計）"],
    [f(`="　アクティブ "&COUNTIF($C$5:$C$${last},">0")&" 名　｜　累計 "&SUM($C$5:$C$${last})&" セッション　｜　このシートで入力するのは黄色の列だけ（目標・次回予定・備考）"`)],
    [],
    ["クライアント","目標","回数","種目数","達成✅","未達❌","達成率","最終来場","次回予定(入力)","備考(入力)"]
  ];
  cs.forEach((c,k)=>{
    const r=5+k;
    aoa.push([
      c.name, c.goal,
      f(`=IFERROR(ROWS(UNIQUE(FILTER(記録!$A$5:$A$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$A${r}))),0)`),
      f(`=COUNTIFS(記録!$B$5:$B$${SHEET_LAST},$A${r})`),
      f(`=COUNTIFS(記録!$B$5:$B$${SHEET_LAST},$A${r},記録!$G$5:$G$${SHEET_LAST},"✅")`),
      f(`=COUNTIFS(記録!$B$5:$B$${SHEET_LAST},$A${r},記録!$G$5:$G$${SHEET_LAST},"❌")`),
      f(`=IF($E${r}+$F${r}=0,"－",TEXT($E${r}/($E${r}+$F${r}),"0%"))`),
      f(`=IFERROR(TEXT(MAX(FILTER(記録!$A$5:$A$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$A${r})),"yyyy/mm/dd"),"未実施")`),
      null, null
    ]);
  });
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"]=[{wch:14},{wch:30},{wch:7},{wch:8},{wch:8},{wch:8},{wch:8},{wch:12},{wch:13},{wch:18}];
  return ws;
}

function sheetInput(firstClient,dashLast){
  const aoa=[
    ["✍️ かんたん入力（前回メニューを自動で呼び出し）"],
    ["①B4に名前（D4は空欄なら今日）　②前回から変わったところだけ入力（空欄=前回と同じ、達成の空欄=✅）　③コピー用 M7:T16 を選択してコピー　④「記録」シートの一番下の空行のA列に値のみ貼り付け"],
    [],
    ["クライアント",firstClient,"日付",null,"前回",f(`=IF($U$4="","記録なし",TEXT($U$4,"m/d"))`)],
    [],
    ["前回の種目(自動)","前回重量","前回回数","前回セット",null,"種目を変える時","重量","回数","セット","達成","メモ",null,"↓コピー用（ここは触らない）M7:T16"]
  ];
  for(let k=0;k<INPUT_ROWS;k++){
    const r=7+k, nth=k+1;
    const row=new Array(20).fill(null);
    row[0]=f(`=IF($U$4="","",IFERROR(INDEX(FILTER(記録!$C$5:$C$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$B$4,記録!$A$5:$A$${SHEET_LAST}=$U$4),${nth}),""))`);
    row[1]=f(`=IF($A${r}="","",IFERROR(INDEX(FILTER(記録!$D$5:$D$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$B$4,記録!$A$5:$A$${SHEET_LAST}=$U$4),${nth}),""))`);
    row[2]=f(`=IF($A${r}="","",IFERROR(INDEX(FILTER(記録!$E$5:$E$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$B$4,記録!$A$5:$A$${SHEET_LAST}=$U$4),${nth}),""))`);
    row[3]=f(`=IF($A${r}="","",IFERROR(INDEX(FILTER(記録!$F$5:$F$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$B$4,記録!$A$5:$A$${SHEET_LAST}=$U$4),${nth}),""))`);
    row[12]=f(`=IF(AND($A${r}="",$F${r}=""),"",IF($D$4="",TODAY(),$D$4))`);
    row[13]=f(`=IF(AND($A${r}="",$F${r}=""),"",$B$4)`);
    row[14]=f(`=IF(AND($A${r}="",$F${r}=""),"",IF($F${r}<>"",$F${r},$A${r}))`);
    row[15]=f(`=IF(AND($A${r}="",$F${r}=""),"",IF($G${r}<>"",$G${r},$B${r}))`);
    row[16]=f(`=IF(AND($A${r}="",$F${r}=""),"",IF($H${r}<>"",$H${r},$C${r}))`);
    row[17]=f(`=IF(AND($A${r}="",$F${r}=""),"",IF($I${r}<>"",$I${r},$D${r}))`);
    row[18]=f(`=IF(AND($A${r}="",$F${r}=""),"",IF($J${r}<>"",$J${r},"✅"))`);
    row[19]=f(`=IF(AND($A${r}="",$F${r}=""),"",$K${r})`);
    aoa.push(row);
  }
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws["U4"]=f(`=IFERROR(MAX(FILTER(記録!$A$5:$A$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$B$4)),"")`);
  ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:6+INPUT_ROWS,c:20}});
  ws["!cols"]=[{wch:20},{wch:10},{wch:10},{wch:10},{wch:3},{wch:18},{wch:8},{wch:8},{wch:8},{wch:6},{wch:24}];
  return ws;
}

function sheetKarte(firstClient,dashLast){
  const aoa=[
    ["👤 カルテ（クライアント別履歴・自動表示）"],
    ["B4に名前を入れると、その人の全記録が新しい順に表示されます。"],
    [],
    ["クライアント",firstClient,f(`=IFERROR("目標："&VLOOKUP($B$4,ダッシュボード!$A$5:$B$${dashLast},2,FALSE),"")`)],
    [],
    ["日付","クライアント","種目","重量kg","回数","セット","達成","メモ"],
    [f(`=IFERROR(SORT(FILTER(記録!$A$5:$H$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$B$4),1,FALSE),"記録がありません")`)]
  ];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"]=[{wch:12},{wch:14},{wch:22},{wch:9},{wch:7},{wch:7},{wch:7},{wch:30}];
  return ws;
}

function sheetLine(cs,dashLast){
  const aoa=[
    ["📱 LINE送信用メッセージ（自動更新）"],
    ["D列をコピーしてLINEに貼り付け。記録シートに追記すると自動で最新セッションを反映します。次回日程はダッシュボードの「次回予定」列から自動で差し込まれます。F列以降は計算用（非表示可）。"],
    [],
    ["クライアント","最終","次回","LINEメッセージ（コピー用）",null,"最終日","種目数","達成数","重量あり","種目1","種目2","種目3"]
  ];
  cs.forEach((c,k)=>{
    const r=5+k, nm=shortName(c.name), gl=goalLine(c.goal);
    const vlook=`VLOOKUP($A${r},ダッシュボード!$A$5:$I$${dashLast},9,FALSE)`;
    const msg=`=IF($F${r}="","（まだ記録がありません）",`
      +`IF($F${r}=TODAY(),"${nm}、本日もお疲れさまでした。","${nm}、先日（"&TEXT($F${r},"m/d")&"）のトレーニングお疲れさまでした。")`
      +`&CHAR(10)&CHAR(10)&IF($F${r}=TODAY(),"本日は","この日は")&""&$J${r}`
      +`&IF($K${r}="","","・"&$K${r})&IF($L${r}="","","・"&$L${r})&"など全"&$G${r}&"種目に取り組みました。"`
      +`&IF($H${r}>=$G${r},"予定していたメニューをすべてしっかりこなせています。","全"&$G${r}&"種目中"&$H${r}&"種目を達成。あと一歩の種目も次回で調整していきましょう。")`
      +`&"${gl}"&CHAR(10)&CHAR(10)`
      +`&"トレーニング後30分以内にタンパク質を20g程度（プロテインや卵、鶏むね肉など）とると、筋肉の回復と代謝アップにつながります。食事は極端に減らさず、まずは飲み物と間食の糖質から見直すのが続けやすいです。"`
      +`&CHAR(10)&CHAR(10)`
      +`&IF(IFERROR(${vlook},"")="","次回のご予約日が決まりましたら、お気軽にお知らせください。またお会いできるのを楽しみにしています。","次回は"&TEXT(${vlook},"m月d日")&"でご予約をお預かりしています。ご都合が変わる場合は、お気軽にご連絡ください。"))`;
    const num=`ISNUMBER(記録!$D$5:$D$${SHEET_LAST})`;
    const pick=n=>`=IF($F${r}="","",IF($I${r}>=2,`
      +`IFERROR(INDEX(FILTER(記録!$C$5:$C$${SHEET_LAST}&記録!$D$5:$D$${SHEET_LAST}&"kg",記録!$B$5:$B$${SHEET_LAST}=$A${r},記録!$A$5:$A$${SHEET_LAST}=$F${r},${num}),${n}),""),`
      +`IFERROR(INDEX(FILTER(記録!$C$5:$C$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$A${r},記録!$A$5:$A$${SHEET_LAST}=$F${r}),${n}),"")))`;
    aoa.push([
      c.name,
      f(`=IF($F${r}="","－",TEXT($F${r},"m/d"))`),
      f(`=IFERROR(IF(${vlook}="","未定",TEXT(${vlook},"m/d")),"未定")`),
      f(msg), null,
      f(`=IFERROR(MAX(FILTER(記録!$A$5:$A$${SHEET_LAST},記録!$B$5:$B$${SHEET_LAST}=$A${r})),"")`),
      f(`=IF($F${r}="","",COUNTIFS(記録!$B$5:$B$${SHEET_LAST},$A${r},記録!$A$5:$A$${SHEET_LAST},$F${r}))`),
      f(`=IF($F${r}="","",COUNTIFS(記録!$B$5:$B$${SHEET_LAST},$A${r},記録!$A$5:$A$${SHEET_LAST},$F${r},記録!$G$5:$G$${SHEET_LAST},"✅"))`),
      f(`=IF($F${r}="","",SUMPRODUCT((記録!$B$5:$B$${SHEET_LAST}=$A${r})*(記録!$A$5:$A$${SHEET_LAST}=$F${r})*${num}))`),
      f(pick(1)), f(pick(2)), f(pick(3))
    ]);
  });
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"]=[{wch:14},{wch:8},{wch:8},{wch:60},{wch:3},{wch:11},{wch:8},{wch:8},{wch:9},{wch:18},{wch:18},{wch:18}];
  return ws;
}

function sheetChart(firstClient,firstExercise){
  const cond=`記録!$B$5:$B$${SHEET_LAST}=$B$4,記録!$C$5:$C$${SHEET_LAST}=$B$5,ISNUMBER(記録!$D$5:$D$${SHEET_LAST})`;
  const aoa=[
    ["📈 重量推移グラフ（自動）"],
    ["B4にクライアント、B5に種目を入れると推移データが切り替わります。重量が数値の記録だけを表示します。"],
    [],
    ["クライアント",firstClient],
    ["種目",firstExercise],
    [],
    ["日付","重量(kg)"],
    [
      f(`=IFERROR(SORT(FILTER(記録!$A$5:$A$${SHEET_LAST},${cond}),1,TRUE),"")`),
      f(`=IFERROR(SORT(FILTER(記録!$D$5:$D$${SHEET_LAST},${cond}),FILTER(記録!$A$5:$A$${SHEET_LAST},${cond}),TRUE),"")`)
    ]
  ];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"]=[{wch:14},{wch:12}];
  return ws;
}

function sheetExercises(list){
  const ws=XLSX.utils.aoa_to_sheet([["種目リスト"],...list.map(x=>[x])]);
  ws["!cols"]=[{wch:26}];
  return ws;
}

/* ---- 本体 ---- */
window.axisExportSubmitExcel=function(){
  if(typeof XLSX==="undefined"){alert("Excel機能を読み込めませんでした。再読み込みしてください。");return}
  const rows=(typeof all==="function"?all():[]).slice()
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.client).localeCompare(String(b.client),"ja"));
  if(!rows.length){alert("書き出せる記録がありません。");return}

  const cs=clientsWithGoals();
  if(!cs.length){alert("利用者が登録されていません。");return}
  const dashLast=4+cs.length;
  const first=cs[0].name;
  const used=typeof axisExerciseRegistry==="function"?axisExerciseRegistry()
            :(typeof exerciseList==="function"?exerciseList():[]);
  const exList=[...new Set([...MASTER_EXERCISES,...used])];

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheetDashboard(cs),"ダッシュボード");
  XLSX.utils.book_append_sheet(wb,sheetInput(first,dashLast),"入力");
  XLSX.utils.book_append_sheet(wb,sheetRecords(rows),"記録");
  XLSX.utils.book_append_sheet(wb,sheetKarte(first,dashLast),"カルテ");
  XLSX.utils.book_append_sheet(wb,sheetLine(cs,dashLast),"LINE文面");
  XLSX.utils.book_append_sheet(wb,sheetChart(first,exList[0]||"ベンチプレス"),"グラフ");
  XLSX.utils.book_append_sheet(wb,sheetExercises(exList),"種目リスト");

  const d=new Date(), p=n=>String(n).padStart(2,"0");
  XLSX.writeFile(wb,`トレーニング管理_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.xlsx`);
};

/* 「その他」のExcel欄に提出用ボタンを出す */
function injectButton(){
  const btn=[...document.querySelectorAll("button")].find(b=>/全履歴Excel|全履歴をExcel/.test(b.textContent));
  if(!btn||document.querySelector("#axisSubmitExcel")) return;
  const b=document.createElement("button");
  b.id="axisSubmitExcel";
  b.className=btn.className.includes("ax16")?"ax16-btn pri":"btn primary";
  b.style.cssText="width:100%;margin-top:8px";
  b.textContent="提出用Excel（7シート）を書き出す";
  b.onclick=()=>window.axisExportSubmitExcel();
  btn.parentElement.appendChild(b);
}
document.addEventListener("click",()=>setTimeout(injectButton,60));
setTimeout(injectButton,900);
window.axisInjectSubmitExcelButton=injectButton;
})();
