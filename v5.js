
(function(){
  const style=document.createElement("style");
  style.textContent=`.quickbar{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0 10px}.quickbtn{border:1px solid var(--line);background:#f8fafc;border-radius:999px;padding:7px 10px;font-size:12px;color:#475569;font-weight:700}.autonote{background:#ecfdf5;color:#166534;border:0;border-radius:12px;padding:9px 11px;font-weight:800}.notegrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.notegrid textarea{min-height:92px}.nextdate{background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:11px;margin:10px 0;font-size:13px;color:#1e3a8a}@media(max-width:560px){.notegrid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  window.clientNameKey=x=>String(x||"").normalize("NFKC").replace(/\s/g,"").replace(/さん|様|氏/g,"");
  window.matchedClientFromTitle=title=>{
    const t=clientNameKey(title);
    return clientList().map(x=>x.name).find(n=>{const k=clientNameKey(n);return k&&t.includes(k)})||""
  };
  window.normalizedCalendarSchedule=()=> (META.calendarEvents||[]).map(e=>{
    const title=String(e.summary||"予定").trim(),known=matchedClientFromTitle(title);
    if(!known)return null;
    let type="予定";
    if(title.includes("パーソナル"))type="パーソナル";
    else if(title.includes("ケア")||title.includes("整体")||title.includes("施術"))type="ケア";
    else if(title.includes("体験"))type="体験";
    return {date:String(e.start||"").slice(0,10),time:String(e.start||"").slice(11,16),client:known,type,label:title,calendar:true,eventId:e.id||""}
  }).filter(Boolean).filter(x=>x.date&&x.time);

  window.nextTrainingDate=c=>{
    const now=new Date();
    return mergedSchedule().filter(x=>x.client===c&&x.type!=="ケア")
      .map(x=>({...x,_d:new Date(`${x.date}T${x.time}:00+09:00`)}))
      .filter(x=>x._d>now).sort((a,b)=>a._d-b._d)[0]||null
  };
  window.nextTrainingText=c=>{
    const x=nextTrainingDate(c);return x?`${jp(x.date)} ${x.time}〜`:"未登録"
  };
  window.insightOf=s=>s?.insight??s?.note??"";
  window.cautionOf=s=>s?.caution??"";
  window.shareOf=s=>s?.share??"";
  window.sessionMemo=s=>[
    insightOf(s)?`気づき:${insightOf(s)}`:"",
    cautionOf(s)?`注意点:${cautionOf(s)}`:"",
    shareOf(s)?`共有事項:${shareOf(s)}`:"",
    s?.next?`次回:${s.next}`:"",
    s?.rpe?`RPE:${s.rpe}`:"",
    s?.pain!==undefined&&s?.pain!==""?`痛み:${s.pain}`:""
  ].filter(Boolean).join(" | ");
  window.all=()=>BASE.concat(added.flatMap(s=>(s.exercises||[]).map(e=>({date:s.date,client:s.client,exercise:e.exercise,weight:e.weight,reps:e.reps,sets:e.sets,achieved:s.status,memo:sessionMemo(s),source:"アプリ入力"}))));
  window.appRows=()=>added.flatMap(s=>(s.exercises||[]).map(e=>({date:s.date,client:s.client,exercise:e.exercise,weight:e.weight,reps:e.reps,sets:e.sets,achieved:s.status||"完了",memo:sessionMemo(s),source:"アプリ入力"})));

  window.professionalAdvice=c=>{
    const goal=String(META.goals?.[c]||""),out=[];
    if(/膝|痛/.test(goal))out.push("痛みがある日は負荷や可動域を無理に上げず、痛みの出ない範囲で大腿部・臀部をしっかり使うことを優先しましょう。関節への負担を抑えながら筋力を維持する狙いです。");
    if(/ダイエット|引き締め|腹部/.test(goal))out.push("引き締めはトレーニングだけでなく、日常の活動量と食事の継続が重要です。毎食たんぱく質を入れ、歩く量を少しずつ確保すると筋量を保ちながら進めやすくなります。");
    if(/筋肥大|大き/.test(goal))out.push("筋肉をつけるには、8〜12回であと1〜3回できる余裕を残す強度が目安です。フォームが崩れない範囲で少しずつ重量か回数を伸ばし、食事と睡眠も合わせて整えましょう。");
    if(/BIG3/.test(goal))out.push("BIG3は重量だけでなくフォームの再現性が重要です。RPE7〜8（あと2〜3回できる余裕）を目安に、同じ動きを安定して繰り返せる状態から負荷を上げましょう。");
    if(/ゴルフ/.test(goal))out.push("飛距離アップには脚力だけでなく、股関節の伸展・回旋と体幹の安定性が重要です。下半身で作った力を上半身へ伝えられる動きを意識していきましょう。");
    return out.length?out:["次回もフォームを優先し、RPE7〜8程度の余裕を残しながら、回数か重量のどちらか一つだけ少し伸ばしていきましょう。"]
  };
  window.professionalLine=(c,a)=>{
    const nd=nextTrainingDate(c);
    const dateLine=nd?`次回は${jp(nd.date)} ${nd.time}〜の予定です。ご都合大丈夫そうでしょうか？`:"次回日程がまだ未登録です。ご都合の良い日時があれば教えてください。";
    const firstProgress=a.progress?.[0]||`${a.recent?.[0]?.rows?.[0]?.exercise||"トレーニング"}を継続`;
    const firstNext=(a.next||[]).slice(0,2).map(x=>x.text).join("、")||"今回の内容をベースに状態を見ながら調整";
    return `${displayClientName(c)}、本日もありがとうございました😊
今回は${firstProgress}できています。
次回は${firstNext}していく予定です。

【今日のポイント】
${professionalAdvice(c)[0]}

${dateLine}
無理のない範囲で続けていきましょう！
また次回もよろしくお願いします😊`
  };

  window.analysisHTML=c=>{
    const a=analyzeClient(c),vols=a.recent.map(x=>({date:x.date,value:Math.round(sessionVolume(x))})).filter(x=>x.value>0).reverse(),advice=professionalAdvice(c),line=professionalLine(c,a);
    return `<div class="title"><h3>データ分析・次回提案</h3></div>
    <div class="nextdate"><b>次回トレーニング：</b>${esc(nextTrainingText(c))}</div>
    <div class="metric-row"><div class="metric"><b>${a.recent.length}</b><span>直近分析回数</span><div class="metric"><b>${a.progress.length}</b><span>伸びた項目</span></div><div class="metric"><b>${a.next.length}</b><span>次回候補種目</span></div></div>
    ${a.refIncluded?'<div class="source-note">※分析には「参考（補完・想定）」記録を含みます。実施済み記録とは分けて確認してください。</div>':""}
    <div class="analysis-grid">
      <div class="analysis-card"><h3>分析</h3><ul>${a.summary.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${vols.length?`<div class="sub" style="margin-top:10px">総負荷量（重量×回数×set、数値化できる種目のみ）</div>${vols.map(v=>`<div class="sub">${fmt(v.date)}：${v.value.toLocaleString()} kg</div>`).join("")}`:""}</div>
      <div class="analysis-card"><h3>次にした方がいいこと</h3><ul>${a.next.slice(0,8).map(x=>`<li><b>${esc(x.exercise)}</b>：${esc(x.text)}</li>`).join("")}</ul><button class="btn soft" style="width:100%;margin-top:10px" onclick="useSuggestedMenu('${c.replace(/'/g,"\\'")}')">この提案でトレ開始</button></div>
      <div class="analysis-card"><h3>お客様へのアドバイス</h3><ul>${advice.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="analysis-card"><h3>LINE文面</h3><textarea id="lineText" class="linebox">${esc(line)}</textarea><button id="copyLineBtn" class="btn primary" style="width:100%;margin-top:8px" onclick="copyLine()">LINE文面をコピー</button></div>
    </div>`
  };

  window.appendField=(id,text)=>{const el=$("#"+id);if(!el)return;el.value=(el.value?el.value+"／":"")+text;saveDraft()};
  window.autoFillSessionNotes=()=>{
    const c=$("#fclient")?.value||"",date=$("#fdate")?.value||today();if(!c){alert("利用者を選んでください");return}
    const prev=latest(c,date),pain=n($("#fpain")?.value,0),rpe=n($("#frpe")?.value,0),changes=[],completed=exs.reduce((a,e)=>a+(e.done?.length||0),0),total=exs.reduce((a,e)=>a+n(e.sets,0),0);
    for(const e of exs){if(!e.exercise)continue;const pr=prev?.rows?.find(r=>r.exercise===e.exercise),w=num(e.weight),pw=pr?num(pr.weight):null,rr=num(e.reps),pR=pr?num(pr.reps):null;if(w!==null&&pw!==null&&w>pw)changes.push(`${e.exercise} ${pw}kg→${w}kg`);else if(rr!==null&&pR!==null&&rr>pR)changes.push(`${e.exercise} ${pR}回→${rr}回`)}
    $("#finsight").value=[changes.length?`前回から伸び：${changes.slice(0,3).join("、")}`:"前回メニューをベースにフォームと反応を確認",total?`実施セット ${completed}/${total}`:"",rpe?`RPE ${rpe}`:"",`痛み ${pain}/10`].filter(Boolean).join("。")+"。";
    const cautions=[META.attention?.[c]||""];if(pain>=4)cautions.push("痛みがあるため、負荷や可動域を上げすぎず症状を確認する。");if(rpe>=9)cautions.push("疲労度が高いため、次回はセット数または負荷を調整する。");
    $("#fcaution").value=cautions.filter(Boolean).join("／");$("#fshare").value=[`状態：${$("#fstatus")?.value||"完了"}`,rpe?`RPE ${rpe}`:"",`痛み ${pain}/10`,total?`セット完了 ${completed}/${total}`:""].filter(Boolean).join("／");if(!$("#fnext").value)$("#fnext").value=(analyzeClient(c).next||[]).slice(0,3).map(x=>x.text).join("／");saveDraft()
  };
  window.carryPreviousNotes=()=>{const c=$("#fclient")?.value||"",prev=added.find(x=>x.client===c);if(!prev){alert("この端末に前回の入力メモがありません");return}if(!$("#fcaution").value)$("#fcaution").value=cautionOf(prev);if(!$("#fshare").value)$("#fshare").value=shareOf(prev);if(!$("#fnext").value)$("#fnext").value=prev.next||"";saveDraft()};

  window.renderInput=p=>{
    p=p||{};const cs=clientList().map(x=>x.name),ex=p.exercises||[{exercise:"",weight:0,weightStep:1,reps:10,sets:3,done:[]}];window.exs=ex.map(x=>({...x,weight:normalizeWeight(x.weight),weightStep:x.weightStep||inferWeightStep(x.weight),done:Array.isArray(x.done)?x.done:[]}));const insight=p.insight??p.note??"",caution=p.caution??(p.client?META.attention?.[p.client]||"":"");
    $("#input").innerHTML=`<div class="timerbar"><span id="timerText">休憩タイマー</span><span><button onclick="startTimer(60)">60秒</button> <button onclick="startTimer(90)">90秒</button></span></div><div class="title"><h3>トレ中入力</h3></div><div class="form"><div class="row"><input id="fdate" type="date" value="${p.date||today()}"><select id="fclient"><option value="">利用者</option>${cs.map(c=>`<option ${p.client===c?"selected":""}>${esc(c)}</option>`).join("")}</select><select id="fstatus"><option>完了</option><option>良好</option><option>要確認</option><option>変更</option></select><select id="frpe"><option value="">RPE</option>${[1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.rpe)===String(x)?"selected":""}>${x}</option>`).join("")}</select></div></div><div class="title"><h3>メニュー</h3><button class="btn soft" onclick="addEx()">＋種目</button></div><div id="editors"></div><div class="form"><label class="sub">痛み 0〜10</label><select id="fpain">${[0,1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.pain)===String(x)?"selected":""}>${x}</option>`).join("")}</select><div class="quickbar"><button class="autonote" onclick="autoFillSessionNotes()">✨ 気づき等を自動作成</button><button class="quickbtn" onclick="carryPreviousNotes()">前回メモ引継ぎ</button></div><div class="notegrid"><div><b>今日の気づき</b><div class="quickbar"><button class="quickbtn" onclick="appendField('finsight','フォーム良好')">フォーム良好</button><button class="quickbtn" onclick="appendField('finsight','前回より安定')">前回より安定</button><button class="quickbtn" onclick="appendField('finsight','疲労あり')">疲労あり</button></div><textarea id="finsight">${esc(insight)}</textarea></div><div><b>注意点</b><div class="quickbar"><button class="quickbtn" onclick="appendField('fcaution','フォーム優先')">フォーム優先</button><button class="quickbtn" onclick="appendField('fcaution','可動域を確認')">可動域</button><button class="quickbtn" onclick="appendField('fcaution','痛みを確認')">痛み確認</button></div><textarea id="fcaution">${esc(caution)}</textarea></div><div><b>共有事項</b><div class="quickbar"><button class="quickbtn" onclick="appendField('fshare','体調問題なし')">体調問題なし</button><button class="quickbtn" onclick="appendField('fshare','負荷調整あり')">負荷調整</button><button class="quickbtn" onclick="appendField('fshare','痛みあり')">痛みあり</button></div><textarea id="fshare">${esc(p.share||"")}</textarea></div><div><b>次回やること</b><div class="quickbar"><button class="quickbtn" onclick="appendField('fnext','重量UP検討')">重量UP</button><button class="quickbtn" onclick="appendField('fnext','回数UP検討')">回数UP</button><button class="quickbtn" onclick="appendField('fnext','同負荷でフォーム確認')">同負荷</button></div><textarea id="fnext">${esc(p.next||"")}</textarea></div></div><div class="nextdate"><b>次回トレーニング：</b>${p.client?esc(nextTrainingText(p.client)):"利用者を選択すると表示"}</div><button class="btn primary" style="width:100%;margin-top:10px" onclick="save()">今日の記録を保存</button></div>`;
    drawEx();["fdate","fclient","fstatus","frpe","fpain","finsight","fcaution","fshare","fnext"].forEach(id=>$("#"+id).addEventListener("input",saveDraft));$("#fclient").addEventListener("change",()=>{const d=currentDraft();d.client=$("#fclient").value;if(!d.caution)d.caution=META.attention?.[d.client]||"";renderInput(d);saveDraft()})
  };
  window.currentDraft=()=>({date:$("#fdate")?.value||today(),client:$("#fclient")?.value||"",status:$("#fstatus")?.value||"完了",rpe:$("#frpe")?.value||"",pain:$("#fpain")?.value||0,insight:$("#finsight")?.value||"",caution:$("#fcaution")?.value||"",share:$("#fshare")?.value||"",next:$("#fnext")?.value||"",exercises:exs||[]});
  window.save=()=>{let s=currentDraft();s.exercises=s.exercises.filter(x=>x.exercise);if(!s.date||!s.client||!s.exercises.length){alert("日付・利用者・メニューを入力してください");return}if(!s.insight&&!s.caution&&!s.share){autoFillSessionNotes();s=currentDraft();s.exercises=s.exercises.filter(x=>x.exercise)}s.savedAt=new Date().toISOString();added.unshift(s);localStorage.setItem("axis_training_added",JSON.stringify(added));localStorage.removeItem("axis_training_draft");draft=null;renderAll();alert("保存しました");openClient(s.client)};

  window.exportExcel=scope=>{
    scope=scope||"new";if(typeof XLSX==="undefined"){alert("Excel機能を読み込めませんでした。");return}const src=scope==="all"?all():appRows();if(!src.length){alert("まだアプリで保存した記録がありません。");return}const wb=XLSX.utils.book_new(),ss=added.slice();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["日付","クライアント","種目","重量kg","回数","セット","達成","メモ","区分"],...src.map(r=>[r.date,r.client,r.exercise,r.weight,r.reps,r.sets,r.achieved,r.memo,r.source])]),"記録");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["日付","時間","クライアント","状態","RPE","痛み","メニュー","今日の気づき","次回やること","注意点","共有事項","次回トレーニング日"],...ss.map(x=>[x.date,x.savedAt?new Date(x.savedAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"",x.client,x.status||"完了",x.rpe||"",x.pain??"",(x.exercises||[]).map(e=>`${e.exercise} ${e.weight}${typeof e.weight==="number"?"kg":""} ${e.reps}回×${e.sets}set`).join("\n"),insightOf(x),x.next||"",cautionOf(x),shareOf(x),nextTrainingText(x.client)])]),"入力");
    const clients=clientList().map(x=>x.name);XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["クライアント","目標","直近日","直近メニュー","気づき","注意点","共有事項","次回やること","次回トレーニング日"],...clients.map(c=>{const l=latest(c),own=added.find(x=>x.client===c);return[c,META.goals?.[c]||"",l?.date||"",l?l.rows.map(r=>`${r.exercise} ${r.weight}${typeof r.weight==="number"?"kg":""} ${r.reps}回×${r.sets}set`).join("\n"):"",own?insightOf(own):"",own?cautionOf(own):(META.attention?.[c]||""),own?shareOf(own):"",own?.next||"",nextTrainingText(c)]})]),"カルテ");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["クライアント","日付","LINE文面"],...ss.map(x=>{const a=analyzeClient(x.client);return[x.client,x.date,professionalLine(x.client,a)]})]),"LINE文面");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["クライアント","日付","総負荷量kg"],...clients.flatMap(c=>sessions(c).map(se=>[c,se.date,Math.round(sessionVolume(se))]))]),"グラフ");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["種目"],...exerciseList().map(x=>[x])]),"種目リスト");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["AXIS TRAINING ダッシュボード"],["出力日時",new Date().toLocaleString("ja-JP")],["利用者数",clients.length],["アプリ保存セッション",added.length],["重要項目","メニュー・気づき・注意点・共有事項・次回やること・次回トレーニング日を収録"]]),"ダッシュボード");
    const tag=today().replaceAll("-","");XLSX.writeFile(wb,`AXIS_トレーニング記録_${scope==="all"?"全履歴":"Excel取込"}_${tag}.xlsx`,{compression:true})
  };
})();
