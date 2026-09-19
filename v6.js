(function(){
  const HIDE_KEY="axis_hidden_schedule_v1";
  function hiddenKeys(){
    try{const x=JSON.parse(localStorage.getItem(HIDE_KEY)||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}
  }
  function saveHidden(keys){localStorage.setItem(HIDE_KEY,JSON.stringify([...new Set(keys)]))}
  window.scheduleKey=function(s){
    if(s&&s.calendar&&s.eventId)return "cal:"+s.eventId;
    return "local:"+[s?.date||"",s?.time||"",s?.label||s?.client||"",s?.type||""].join("|")
  };
  const rawMerged=window.mergedSchedule;
  window._rawMergedSchedule=rawMerged;
  window.mergedSchedule=function(){
    const hidden=new Set(hiddenKeys());
    return rawMerged().filter(s=>!hidden.has(scheduleKey(s)))
  };
  window.hideScheduleItem=function(key,label){
    if(!confirm("「"+label+"」をAXIS TRAININGの予定から外しますか？\n\nGoogleカレンダーの予定自体は削除しません。"))return;
    const keys=hiddenKeys();keys.push(key);saveHidden(keys);renderAll()
  };
  window.restoreScheduleItem=function(key){
    saveHidden(hiddenKeys().filter(x=>x!==key));renderAll()
  };
  window.restoreAllScheduleItems=function(){saveHidden([]);renderAll()};

  const baseCard=window.card;
  window.card=function(s){
    let html=baseCard(s);
    const key=scheduleKey(s),label=String(s.label||s.client||"予定");
    const escJs=v=>String(v).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    const btn='<button class="btn danger" style="margin-top:8px;padding:7px 10px" onclick="event.stopPropagation();hideScheduleItem(\''+escJs(key)+'\',\''+escJs(label)+'\')">予定から外す</button>';
    return html.replace(/<\/div><\/div>$/,btn+"</div></div>")
  };

  const baseRenderSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    baseRenderSchedule();
    const root=document.querySelector("#schedule"),hidden=new Set(hiddenKeys());
    const items=rawMerged().filter(s=>hidden.has(scheduleKey(s)));
    if(!items.length)return;
    const box=document.createElement("div");
    box.className="card";
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>非表示にした予定</b><button class="btn soft" onclick="restoreAllScheduleItems()">すべて戻す</button></div>'+
      items.map(s=>'<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid #e5e7eb;padding:9px 0;margin-top:8px"><span>'+esc(s.date+" "+s.time+" "+(s.label||s.client))+'</span><button class="btn soft" onclick="restoreScheduleItem(\''+String(scheduleKey(s)).replace(/'/g,"\\'")+'\')">戻す</button></div>').join("");
    root.appendChild(box)
  };
})();