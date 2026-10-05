/* AXIS v24 メニュー表示のまとめ
   ドロップセットを1行ずつ展開すると、同じ種目が何行も並んでレポートが読みづらくなる。
   続けて出てくる同じ種目は1行にまとめ、重量の変化を矢印で見せる。 */
(function(){
"use strict";

function fmtW(w){ return String(w)==="自重"?"自重":String(w)+"kg" }

/* 連続する同じ種目をまとめる */
window.axisGroupMenuRows=function(rows){
  const out=[];
  (rows||[]).forEach(r=>{
    const name=String(r.exercise||"");
    const sets=Math.max(1,Number(r.sets)||1);
    const last=out[out.length-1];
    if(last&&last.exercise===name){
      last.weights.push({w:r.weight,n:sets});
      last.reps.push(Number(r.reps)||0);
      last.sets+=sets;
    }else{
      out.push({exercise:name,weights:[{w:r.weight,n:sets}],reps:[Number(r.reps)||0],sets:sets});
    }
  });
  return out.map(g=>{
    const uniq=[...new Set(g.weights.map(x=>String(x.w)))];
    let weightText;
    if(uniq.length===1) weightText=fmtW(g.weights[0].w);
    else if(uniq.length<=6) weightText=uniq.map((w,i)=>i===0?fmtW(w):(String(w)==="自重"?"自重":String(w))).join("→")+(String(uniq[uniq.length-1])==="自重"?"":"kg");
    else {
      const nums=g.weights.map(x=>Number(x.w)).filter(Number.isFinite);
      weightText=nums.length?`${Math.min(...nums)}〜${Math.max(...nums)}kg`:fmtW(g.weights[0].w);
    }
    const ur=[...new Set(g.reps)];
    const repText=ur.length===1?`${ur[0]}回`:`${Math.min(...ur)}〜${Math.max(...ur)}回`;
    return {exercise:g.exercise,weightText,repText,sets:g.sets,
            detail:`${weightText} / ${repText} / ${g.sets}set`};
  });
};

/* まとめた行でメニュー一覧を描く */
window.axisMenuRowsHtml=function(rows,limit){
  const g=window.axisGroupMenuRows(rows);
  if(!g.length) return '<div class="axp-muted">記録はありません。</div>';
  const max=limit||12;
  const shown=g.slice(0,max);
  return shown.map((x,i)=>
    '<div class="axp-menurow"><i>'+String(i+1).padStart(2,"0")+'</i><b>'+esc(x.exercise)+'</b>'+
    '<span>'+esc(x.detail)+'</span></div>'
  ).join("")+(g.length>max?'<div class="axp-muted" style="padding-top:6px">ほか '+(g.length-max)+'種目</div>':"");
};
window.axisMenuCount=function(rows){ return window.axisGroupMenuRows(rows).length };
})();
