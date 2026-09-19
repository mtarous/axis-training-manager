(function(){
window.axisDateLocal=function(x){const d=new Date(x);const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day};
window.axisWeekSessions=function(){
 const now=new Date(),dow=(now.getDay()+6)%7,start=new Date(now);start.setHours(0,0,0,0);start.setDate(now.getDate()-dow);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return axisDateLocal(d)});
 const map=new Map(days.map(x=>[x,0]));sessions().forEach(s=>{if(map.has(s.date))map.set(s.date,map.get(s.date)+sessionVolume(s))});
 return days.map(d=>({d,v:Math.round(map.get(d)||0)}))
};
window.axisMonthStats=function(){
 const t=today(),m=t.slice(0,7),ss=sessions().filter(x=>x.date?.startsWith(m)&&x.date<=t),vol=ss.reduce((a,s)=>a+sessionVolume(s),0);
 const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);const cut=axisDateLocal(cutoff),clients=clientList(),eligible=clients.filter(c=>sessions(c.name).some(s=>s.date<cut));
 const active=eligible.filter(c=>sessions(c.name).some(s=>s.date>=cut&&s.date<=t)).length,rate=eligible.length?Math.round(active/eligible.length*100):100;
 return {sessions:ss.length,vol:Math.round(vol),rate}
};
window.axisSparkline=function(items,key="v"){
 const vals=(items||[]).map(x=>Number(x[key]||0));if(vals.length<2)return '<div class="ax-muted">推移データ不足</div>';
 const w=280,h=82,pad=8,min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min),pts=vals.map((v,i)=>({x:pad+i*(w-pad*2)/(vals.length-1),y:h-pad-(v-min)/range*(h-pad*2)}));
 return `<div class="ax-trend"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="ax-axis-line" x1="8" y1="${h-8}" x2="${w-8}" y2="${h-8}"/><polyline class="ax-trend-line" points="${pts.map(p=>p.x+','+p.y).join(' ')}"/>${pts.map(p=>`<circle class="ax-trend-dot" cx="${p.x}" cy="${p.y}" r="3"/>`).join('')}</svg></div>`
};
window.axisClientMetrics=function(c){
 const hist=sessions(c).slice(0,8).reverse(),vols=hist.map(s=>({d:s.date,v:Math.round(sessionVolume(s))})),maxes=hist.map(s=>({d:s.date,v:Math.max(0,...s.rows.map(r=>Number.isFinite(Number(r.weight))?Number(r.weight):0))}));
 const last=hist.at(-1),prev=hist.at(-2),lastVol=last?sessionVolume(last):0,prevVol=prev?sessionVolume(prev):0,delta=prevVol?Math.round((lastVol-prevVol)/prevVol*100):0;
 const recentInput=added.find(x=>x.client===c)||null,parts=last?musclesForExercise? [...new Set(last.rows.flatMap(r=>musclesForExercise(r.exercise)))] : []:[];
 return {hist,vols,maxes,last,prev,lastVol:Math.round(lastVol),delta,rpe:Number(recentInput?.rpe||0),pain:Number(recentInput?.pain||0),parts}
};
window.muscleMap=function(rows){
 const on=new Set((rows||[]).flatMap(r=>musclesForExercise(r.exercise||r))),cl=x=>on.has(x)||on.has("全身")?"muscle-on":"muscle-off";
 return `<div class="muscle-wrap"><svg class="muscle-svg" viewBox="0 0 250 310" role="img" aria-label="鍛えた筋肉 前面・背面">
 <g transform="translate(5,4)">
  <circle class="muscle-silhouette" cx="58" cy="25" r="17"/><path class="muscle-silhouette" d="M48 43 Q58 39 68 43 L78 92 Q76 113 68 123 L69 151 L85 210 L79 282 L66 282 L60 220 L56 164 L52 220 L45 282 L32 282 L27 210 L43 151 L44 123 Q36 113 34 92Z"/>
  <path class="muscle-silhouette" d="M37 50 Q22 55 17 82 L10 142 L23 145 L34 96Z"/><path class="muscle-silhouette" d="M79 50 Q94 55 99 82 L106 142 L93 145 L82 96Z"/>
  <ellipse class="${cl("肩")}" cx="35" cy="58" rx="12" ry="14"/><ellipse class="${cl("肩")}" cx="81" cy="58" rx="12" ry="14"/>
  <path class="${cl("胸")}" d="M43 58 Q50 53 57 59 L56 83 Q48 88 41 81Z"/><path class="${cl("胸")}" d="M59 59 Q66 53 73 58 L75 81 Q68 88 60 83Z"/>
  <path class="${cl("腹筋")}" d="M49 86 L67 86 L68 121 Q58 128 48 121Z"/>
  <ellipse class="${cl("二頭")}" cx="27" cy="88" rx="8" ry="18"/><ellipse class="${cl("二頭")}" cx="89" cy="88" rx="8" ry="18"/>
  <ellipse class="${cl("大腿四頭筋")}" cx="44" cy="177" rx="11" ry="30"/><ellipse class="${cl("大腿四頭筋")}" cx="70" cy="177" rx="11" ry="30"/>
  <ellipse class="${cl("ふくらはぎ")}" cx="39" cy="244" rx="8" ry="25"/><ellipse class="${cl("ふくらはぎ")}" cx="76" cy="244" rx="8" ry="25"/>
  <text x="58" y="302" text-anchor="middle" font-size="10" fill="#7088a2">FRONT</text>
 </g>
 <g transform="translate(128,4)">
  <circle class="muscle-silhouette" cx="58" cy="25" r="17"/><path class="muscle-silhouette" d="M48 43 Q58 39 68 43 L78 92 Q76 113 68 123 L69 151 L85 210 L79 282 L66 282 L60 220 L56 164 L52 220 L45 282 L32 282 L27 210 L43 151 L44 123 Q36 113 34 92Z"/>
  <path class="muscle-silhouette" d="M37 50 Q22 55 17 82 L10 142 L23 145 L34 96Z"/><path class="muscle-silhouette" d="M79 50 Q94 55 99 82 L106 142 L93 145 L82 96Z"/>
  <ellipse class="${cl("肩")}" cx="35" cy="58" rx="12" ry="14"/><ellipse class="${cl("肩")}" cx="81" cy="58" rx="12" ry="14"/>
  <path class="${cl("広背筋")}" d="M39 59 Q58 49 77 59 L73 105 Q65 119 58 122 Q51 119 43 105Z"/>
  <rect class="${cl("脊柱起立筋")}" x="53" y="70" width="10" height="57" rx="5"/>
  <ellipse class="${cl("三頭")}" cx="27" cy="88" rx="8" ry="18"/><ellipse class="${cl("三頭")}" cx="89" cy="88" rx="8" ry="18"/>
  <ellipse class="${cl("臀筋")}" cx="46" cy="145" rx="14" ry="14"/><ellipse class="${cl("臀筋")}" cx="70" cy="145" rx="14" ry="14"/>
  <ellipse class="${cl("ハム")}" cx="44" cy="183" rx="10" ry="30"/><ellipse class="${cl("ハム")}" cx="70" cy="183" rx="10" ry="30"/>
  <ellipse class="${cl("ふくらはぎ")}" cx="39" cy="244" rx="8" ry="25"/><ellipse class="${cl("ふくらはぎ")}" cx="76" cy="244" rx="8" ry="25"/>
  <text x="58" y="302" text-anchor="middle" font-size="10" fill="#7088a2">BACK</text>
 </g></svg><div class="muscle-labels">${[...on].slice(0,6).map(x=>`<span class="muscle-chip">${esc(x)}</span>`).join("")}</div></div>`
};
window.axisScheduleCard=function(s,allowHide=false){
 const l=s.type==="パーソナル"?latest(s.client,s.date):null,key=typeof scheduleKey==="function"?scheduleKey(s):[s.date,s.time,s.label||s.client,s.type].join("|"),label=String(s.label||s.client||"予定"),known=clientList().some(x=>x.name===s.client);
 const click=s.type==="パーソナル"&&known?`onclick="openClient('${String(s.client).replace(/'/g,"\\'")}')"`:"";
 return `<div class="ax-schedule" ${click}><div class="ax-schedule-time"><strong>${esc(s.time)}</strong><span>${s.type==="パーソナル"?"PT":esc(s.type||"予定")}</span></div>
 <div class="ax-schedule-main"><b>${esc(label)}</b><div class="subline">${known&&META.goals?.[s.client]?esc(META.goals[s.client]):s.calendar?"Google Calendar":"AXIS TRAINING"}</div>
 <div class="ax-tags">${l?`<span class="ax-tag">${l.rows.length}種目</span>`:""}${s.type==="パーソナル"?'<span class="ax-tag">40分</span>':""}${s.calendar?'<span class="ax-tag">Calendar</span>':""}</div></div>
 <div class="ax-schedule-actions">${allowHide?`<button class="ax-remove" onclick="event.stopPropagation();hideScheduleItem('${String(key).replace(/'/g,"\\'")}','${label.replace(/'/g,"\\'")}')">予定から外す</button>`:'<span class="ax-chevron">›</span>'}</div></div>`
};
window.renderSchedule=function(){
 const root=$("#schedule"),items=mergedSchedule(),hiddenRaw=typeof _rawMergedSchedule==="function"?_rawMergedSchedule():[],hiddenKeys=new Set(JSON.parse(localStorage.getItem("axis_hidden_schedule_v1")||"[]")),hidden=hiddenRaw.filter(x=>hiddenKeys.has(scheduleKey(x)));
 const grouped=new Map();items.forEach(s=>{if(!grouped.has(s.date))grouped.set(s.date,[]);grouped.get(s.date).push(s)});
 root.innerHTML=`<div class="ax-home-head"><div class="ax-eyebrow">SCHEDULE</div><h2 style="margin:4px 0 5px">スケジュール</h2><div class="ax-muted">Googleカレンダー連携。不要な予定はAXIS上だけ非表示にできます。</div></div>
 ${[...grouped.entries()].map(([date,arr])=>`<div class="ax-date-group">${jp(date)}</div><div style="display:grid;gap:7px">${arr.map(s=>axisScheduleCard(s,true)).join("")}</div>`).join("")||'<div class="ax-panel"><div class="ax-muted">予定はありません</div></div>'}
 ${hidden.length?`<details class="ax-collapsible" style="margin:54px"><summary>非表示にした予定 ${hidden.length}件</summary><div style="display:grid;gap:7px;margin-top:9px">${hidden.map(s=>`<div class="ax-schedule"><div class="ax-schedule-time"><strong>${esc(s.time)}</strong><span>OFF</span></div><div class="ax-schedule-main"><b>${esc(s.label||s.client)}</b><div class="subline">${esc(s.date)}</div></div><button class="btn soft" onclick="restoreScheduleItem('${String(scheduleKey(s)).replace(/'/g,"\\'")}')">戻す</button></div>`).join("")}</div></details>`:""}`;
};

window.professionalAdvice=function(c){
 const m=axisClientMetrics(c),goal=String(META.goals?.[c]||""),out=[];
 if(m.pain>=4)out.push(`痛みが${m.pain}/10あるため、次回は重量を追うより痛みの出ない可動域とフォームを優先しましょう。痛みが増える動きは避け、必要に応じて種目変更します。`);
 else if(m.rpe>=9)out.push(`直近RPEが${m.rpe}と高めです。次回は同じ重量を基準に、フォームの再現性と回復状態を確認してから増量しましょう。`);
 else if(m.rpe>=7)out.push(`直近RPE${m.rpe}で適度な負荷です。フォームが安定していれば、次回は重量か回数のどちらか一方を小さく伸ばすのが効率的です。`);
 if(m.prev&&m.last&&m.delta>=12)out.push(`直近の総負荷量は前回比で約${m.delta}%増えています。伸びは良好ですが、急な負荷増加を続けず、次回は同程度の負荷で動作品質を確認しましょう。`);
 if(m.prev&&m.last&&m.delta<=-15)out.push(`直近の総負荷量は前回より約${Math.abs(m.delta)}%低めです。疲労や体調の影響を確認し、無理に戻さず段階的に負荷を調整しましょう。`);
 if(/ダイエット|引き締め|腹部/.test(goal))out.push("引き締めは筋力トレーニングに加えて、日常活動量と食事の継続が重要です。毎食たんぱく質を確保し、歩数を安定させると筋量を保ちながら進めやすくなります。");
 if(/BIG3/.test(goal))out.push("BIG3は重量よりフォームの再現性を優先します。RPE7〜8（あと2〜3回できる余裕）を基準に、安定してから2.5kg前後ずつ上げましょう。");
 if(/ゴルフ/.test(goal))out.push("飛距離向上には脚力だけでなく、股関節の伸展・回旋と体幹の安定性が重要です。下半身で作った力を上半身へ伝える動きを意識しましょう。");
 if(/膝|痛/.test(goal))out.push("膝の状態を毎回確認し、痛みや腫れがある日は可動域と負荷を下げ、臀筋・大腿部を痛みのない範囲で使います。");
 if(!out.length)out.push("次回はフォームを優先し、RPE7〜8程度の余裕を残しながら、重量か回数のどちらか一つだけ少し伸ばしていきましょう。");
 return out.slice(0,3)
};
window.professionalLine=function(c,a){
 const m=axisClientMetrics(c),nd=nextTrainingDate(c),dateLine=nd?`次回は${jp(nd.date)} ${nd.time}〜の予定です。ご都合大丈夫そうでしょうか？`:"次回日程がまだ未登録です。ご都合の良い日時があれば教えてください。";
 const firstNext=(a?.next||[]).slice(0,2).map(x=>x.text).join("、")||"今回の内容をベースに状態を見ながら調整";
 let progress="今回の内容を安定して実施できています";
 if(m.prev&&m.last&&m.delta>=5)progress=`総負荷量が前回比で約${m.delta}%伸びています`;
 else if(a?.progress?.[0])progress=a.progress[0];
 return `${displayClientName(c)}、本日もありがとうございました😊
今回は${progress}。

次回は${firstNext}していく予定です。

【今日のポイント】
${professionalAdvice(c)[0]}

${dateLine}
また次回もよろしくお願いします😊`
};
window.analysisHTML=function(c){
 const a=analyzeClient(c),m=axisClientMetrics(c),adv=professionalAdvice(c),latestVol=m.lastVol.toLocaleString(),delta=m.prev?(m.delta>0?`+${m.delta}%`:`${m.delta}%`):"—";
 return `<div class="title"><h3>PERFORMANCE</h3></div><div class="nextdate"><b>次回トレーニング</b><br>${esc(nextTrainingText(c))}</div>
 <div class="ax-metric-grid"><div class="ax-metric2"><b>${latestVol}</b><span>直近総負荷 kg</span></div><div class="ax-metric2"><b>${delta}</b><span>前回比</span></div><div class="ax-metric2"><b>${m.hist.length}</b><span>分析セッション</span></div></div>
 <div class="ax-analysis-top"><div class="analysis-card"><div class="ax-eyebrow">VOLUME TREND</div>${axisSparkline(m.vols)}<div class="ax-analysis-list">${(a.progress||[]).slice(0,3).map(x=>`<div class="ax-analysis-item"><b>${esc(x)}</b><div>前回との重量・回数変化を確認</div></div>`).join("")||'<div class="ax-muted">直近は大きな変化なし。フォームの再現性を優先。</div>'}</div></div>${muscleMap(m.last?.rows||[])}</div>
 <div class="analysis-grid" style="margin-top:8px"><div class="analysis-card"><div class="ax-eyebrow">NEXT SESSION</div><ul>${(a.next||[]).slice(0,5).map(x=>`<li><b>${esc(x.exercise)}</b><br>${esc(x.text)}</li>`).join("")}</ul><button class="btn primary" style="width:100%" onclick="useSuggestedMenu('${String(c).replace(/'/g,"\\'")}')">このメニューで開始</button></div>
 <div class="analysis-card"><div class="ax-eyebrow">COACHING</div><ul>${adv.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><button class="btn soft" style="width:100%" onclick="openSummary('${String(c).replace(/'/g,"\\'")}')">お客様向けまとめ</button></div></div>
 <details class="ax-collapsible" style="margin-top:8px"><summary>詳細データを見る</summary><div class="ax-metric-grid"><div class="ax-metric2"><b>${m.maxes.at(-1)?.v||0}</b><span>直近最大重量kg</span></div><div class="ax-metric2"><b>${m.rpe||"—"}</b><span>直近RPE</span></div><div class="ax-metric2"><b>${m.pain||0}</b><span>痛み /10</span></div></div><div class="ax-eyebrow" style="margin-top:8px">MAX WEIGHT TREND</div>${axisSparkline(m.maxes)}</details>
 <details class="ax-collapsible" style="margin-top:8px"><summary>LINE文面を表示</summary><textarea id="lineText" class="linebox" style="margin-top:9px">${esc(professionalLine(c,a))}</textarea><button id="copyLineBtn" class="btn primary" style="width:100%;margin-top:8px" onclick="copyLine()">LINE文面をコピー</button></details>`
};
window.renderAnalytics=function(){
 const week=axisWeekSessions(),clients=clientList(),top=clients.map(c=>({c:c.name,m:axisClientMetrics(c.name)})).sort((a,b)=>b.m.lastVol-a.m.lastVol);
 $("#analytics").innerHTML=`<div class="ax-home-head"><div class="ax-eyebrow">ANALYTICS</div><h2 style="margin:4px 0 6px">データ分析</h2><div class="ax-muted">今週の負荷と、お客様ごとの変化を確認。</div></div>
 <div class="ax-panel"><div class="ax-panel-head"><div class="ax-panel-title">今週のトレーニングボリューム</div><span class="ax-muted">月〜日</span></div>${axisBarChart(week)}</div>
 <div class="title"><h3>CLIENT ANALYTICS</h3></div><div class="grid">${top.map(x=>`<button class="client" onclick="openClient('${String(x.c).replace(/'/g,"\\'")}')"><b>${esc(x.c)}</b><span>直近 ${x.m.lastVol.toLocaleString()}kg　${x.m.prev?(x.m.delta>=0?"+":"")+x.m.delta+"%":"比較なし"}　›</span></button>`).join("")}</div>`
};

})();
