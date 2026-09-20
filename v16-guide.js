/* AXIS v16 exercise guide
   Read-only presentation layer. No training data is mutated here. */
(function(){
"use strict";

let guideCategory="すべて";
let guideQuery="";

function S(s){ return document.querySelector(s); }
function jsq(s){ return String(s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'"); }

function ensureGuideView(){
  if(S("#guide")) return;
  const x=document.createElement("section");
  x.id="guide"; x.className="view";
  S(".main")?.appendChild(x);
}

function guideExercises(){
  return (typeof exerciseList==="function"?exerciseList():[])
    .map(x=>String(x||"").trim()).filter(Boolean)
    .sort((a,b)=>a.localeCompare(b,"ja"));
}

function guideCategoryOf(name){
  const ms=new Set(typeof musclesForExercise==="function"?musclesForExercise(name):[]);
  const n=String(name||"").toLowerCase();
  if(/クランチ|腹|abs|プランク|plank|体幹|バックエクステンション/.test(n)) return "体幹";
  if([...ms].some(x=>["大腿四頭筋","臀筋","ハム","ふくらはぎ"].includes(x))) return "下半身";
  if([...ms].some(x=>["胸","肩","三頭","広背筋","二頭"].includes(x))) return "上半身";
  return "その他";
}

function guideTool(name){
  const n=String(name||"").toLowerCase();
  if(/ダンベル/.test(n)) return "ダンベル";
  if(/バーベル|ベンチ|スクワット|デッド|rdl/.test(n)) return "フリーウェイト";
  if(/マシン|プレス|カール|エクステンション|プルダウン|レッグ/.test(n)) return "マシン";
  if(/自重|プッシュアップ|腕立|プランク|クランチ|懸垂/.test(n)) return "自重";
  if(/ジャンプ|ホップ/.test(n)) return "プライオメトリクス";
  return "トレーニング";
}

function guidePoints(name){
  const n=String(name||"").toLowerCase(), ms=new Set(musclesForExercise(name));
  if(/ベンチ|チェスト|ダンベルプレス|push.?up|プッシュアップ/.test(n)) return [
    "肩甲骨と胸郭を安定させ、肩がすくまない位置をつくる",
    "手首の真下に負荷が乗るようにし、肘の軌道を一定に保つ",
    "反動を使わず、下ろす局面までコントロールする"
  ];
  if(/ラット|ロー|row|pull.?down|プルダウン|懸垂/.test(n)) return [
    "胸を軽く起こし、肩をすくめずに開始姿勢をつくる",
    "手で引くより、肘を後方または下方へ運ぶ意識を持つ",
    "戻す局面も力を抜き切らず、肩甲骨の動きをコントロールする"
  ];
  if(/スクワット|レッグプレス|ブルガリアン|ランジ|lunge/.test(n)) return [
    "足裏全体で床を捉え、左右の荷重をそろえる",
    "膝とつま先の向きを大きくずらさず、体幹を安定させる",
    "深さよりフォームを優先し、痛みのない可動域で行う"
  ];
  if(/デッド|rdl|ルーマニアン|ヒップヒンジ|ヒップスラスト/.test(n)) return [
    "背中の形を保ったまま、股関節から動く",
    "負荷を身体から離しすぎず、足裏で床を押す",
    "腰だけで反らず、臀部とハムストリングスで伸展する"
  ];
  if(/ショルダー|サイドレイズ|ラテラル|shoulder|raise/.test(n)) return [
    "肩をすくめず、首まわりに余計な力を入れない",
    "反動を抑え、狙った可動域を一定にする",
    "手ではなく肘の動きを基準にフォームをそろえる"
  ];
  if(/カール|curl/.test(n)) return [
    "肘の位置を大きく動かさず、上腕を安定させる",
    "手首を折りすぎず、反動を使わない",
    "上げる時だけでなく下ろす時もゆっくりコントロールする"
  ];
  if(/クランチ|腹|abs|プランク|plank|体幹/.test(n)) return [
    "呼吸を止めず、腹圧を保ちながら姿勢をつくる",
    "腰を反りすぎず、肋骨と骨盤の位置を安定させる",
    "時間や回数より、フォームを崩さず続けられる範囲を優先する"
  ];
  if(/ジャンプ|ホップ|jump|hop/.test(n)) return [
    "着地は足裏全体で受け、膝と股関節で衝撃を吸収する",
    "接地位置を身体から離しすぎず、姿勢を崩さない",
    "疲労で着地が乱れたら回数を増やさず終了する"
  ];
  if(ms.has("大腿四頭筋")||ms.has("臀筋")||ms.has("ハム")) return [
    "足裏の荷重と膝の向きをそろえる",
    "体幹を安定させ、反動に頼らない",
    "痛みのない可動域で動作をコントロールする"
  ];
  return [
    "開始姿勢を整えてから動作を始める",
    "反動を抑え、狙った可動域を一定にする",
    "違和感や痛みが出る場合は無理に続けず負荷を調整する"
  ];
}

function guideMuscles(name){
  const m=musclesForExercise(name).filter(x=>x!=="全身");
  return m.length?m:["全身"];
}

function guideThumb(name){
  return '<div class="axg-thumb">'+
    (typeof muscleMap==="function"?muscleMap([{exercise:name}],{chips:false}):"")+
    '<span class="axg-glow"></span></div>';
}

function guideCard(name){
  const cat=guideCategoryOf(name), muscles=guideMuscles(name), points=guidePoints(name);
  return '<button class="axg-card" onclick="openExerciseGuide(\''+jsq(name)+'\')">'+
    guideThumb(name)+
    '<div class="axg-cardbody"><div class="axg-cardtop"><span>'+esc(cat)+'</span><small>'+esc(guideTool(name))+'</small></div>'+
    '<h3>'+esc(name)+'</h3>'+
    '<div class="axg-muscles">'+muscles.slice(0,3).map(x=>'<i>'+esc(x)+'</i>').join("")+'</div>'+
    '<ol>'+points.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>'+
    '<div class="axg-open">詳しく見る '+(typeof v16Icon==="function"?v16Icon("chev"):"›")+'</div></div></button>';
}

function renderGuideList(){
  ensureGuideView();
  const cats=["すべて","下半身","上半身","体幹","その他"];
  const all=guideExercises();
  const q=guideQuery.trim().toLowerCase();
  const list=all.filter(name=>{
    const cat=guideCategoryOf(name), muscles=guideMuscles(name).join(" ");
    return (guideCategory==="すべて"||cat===guideCategory) &&
      (!q||name.toLowerCase().includes(q)||muscles.toLowerCase().includes(q));
  });
  S("#guide").innerHTML=
    '<div class="axg-head"><button class="axg-back" onclick="show(\'more\');renderMore()">'+(typeof v16Icon==="function"?v16Icon("chev"):"‹")+'</button>'+
    '<div><span class="ax16-eyebrow">EXERCISE GUIDE</span><h2>エクササイズガイド</h2><p>フォーム確認と指導のポイントをすぐ確認できます。</p></div></div>'+
    '<div class="axg-search"><span>⌕</span><input id="guideSearch" placeholder="種目名・部位で検索" value="'+esc(guideQuery)+'"></div>'+
    '<div class="axg-cats">'+cats.map(c=>'<button class="'+(guideCategory===c?"on":"")+'" onclick="v16GuideCategory(\''+c+'\')">'+c+'</button>').join("")+'</div>'+
    '<div class="axg-count">'+list.length+' / '+all.length+' 種目</div>'+
    '<div class="axg-grid">'+(list.length?list.map(guideCard).join(""):'<div class="axg-empty">該当する種目がありません</div>')+'</div>';
  const input=S("#guideSearch");
  if(input) input.oninput=e=>{guideQuery=e.target.value;renderGuideList();S("#guideSearch")?.focus();};
}

window.v16GuideCategory=function(cat){ guideCategory=cat; renderGuideList(); };
window.renderExerciseGuide=renderGuideList;
window.openExerciseGuide=function(name){
  ensureGuideView();
  const muscles=guideMuscles(name),points=guidePoints(name),cat=guideCategoryOf(name);
  show("guide",false);
  S("#guide").innerHTML=
    '<div class="axg-head"><button class="axg-back" onclick="renderExerciseGuide()">'+(typeof v16Icon==="function"?v16Icon("chev"):"‹")+'</button>'+
    '<div><span class="ax16-eyebrow">'+esc(cat).toUpperCase()+'</span><h2>'+esc(name)+'</h2><p>'+esc(guideTool(name))+'</p></div></div>'+
    '<div class="axg-detail">'+
      '<section class="ax16-panel axg-visual"><div class="ax16-head"><div class="ax16-h"><span class="ic">'+(typeof v16Icon==="function"?v16Icon("body"):"")+'</span>主な鍛えられる部位</div></div>'+
      guideThumb(name)+'<div class="axg-muscles large">'+muscles.map(x=>'<i>'+esc(x)+'</i>').join("")+'</div></section>'+
      '<section class="ax16-panel"><div class="ax16-head"><div class="ax16-h"><span class="ic">3</span>フォームのポイント</div></div>'+
      '<div class="axg-points">'+points.map((x,i)=>'<div><b>0'+(i+1)+'</b><p>'+esc(x)+'</p></div>').join("")+'</div></section>'+
      '<section class="ax16-panel axg-video"><div class="ax16-head"><div class="ax16-h"><span class="ic">'+(typeof v16Icon==="function"?v16Icon("guide"):"▶")+'</span>解説動画</div></div>'+
      '<div class="axg-videoempty"><div class="axg-play">▶</div><b>動画は準備中です</b><span>高品質な動画が用意できた段階で、ここに差し替えます。</span></div></section>'+
    '</div>';
};

const previousRenderMore=window.renderMore;
window.renderMore=function(){
  if(typeof previousRenderMore==="function") previousRenderMore();
  const root=S("#more"); if(!root) return;
  const entry=document.createElement("div");
  entry.className="ax16-panel axg-entry";
  entry.innerHTML='<div class="ax16-head"><div class="ax16-h"><span class="ic">'+(typeof v16Icon==="function"?v16Icon("guide"):"▶")+'</span>エクササイズガイド</div><span class="ax16-mut">種目・フォーム確認</span></div>'+
    '<p>部位・フォームのポイントを確認できます。動画は高品質な素材が用意できるまで表示しません。</p>'+
    '<button class="ax16-btn pri full" onclick="show(\'guide\',false);renderExerciseGuide()">ガイドを開く '+(typeof v16Icon==="function"?v16Icon("chev"):"›")+'</button>';
  root.prepend(entry);
};

ensureGuideView();
})();