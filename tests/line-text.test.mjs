import assert from 'node:assert/strict';
import test from 'node:test';
const memory = new Map();
globalThis.localStorage = {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const store = await import('../next/core/store.js?v=21');
const {lineMessage} = await import('../next/features/line-text.js');
const exercise = (name, weight=40, side='') => ({name,sets:[{weight,reps:10,side}]});
function seed({notes={},pain='',rpe='',exercises=[exercise('ベンチプレス',45)], pair=false}={}){
  memory.clear();store.load();
  store.upsertClient({id:'test',name:'テスト 利用者',...(pair?{pairLabel:'テストペア'}:{})});
  for(const [id,date,items] of [['old','2026-10-07',[exercise('ベンチプレス',35)]],['new','2026-10-14',exercises]])
    store.saveSession({id,clientId:'test',date,notes:id==='new'?notes:{},pain:id==='new'?pain:'',rpe:id==='new'?rpe:'',exercises:items});
}
test('normal message is concise, records numeric change without claiming unobserved form',()=>{
  seed();const before=JSON.stringify(store.getState());const msg=lineMessage('test');
  assert.match(msg,/35kg×10回 → 今回45kg×10回/);assert.ok(msg.length<450);
  assert.doesNotMatch(msg,/解剖学|生体力学|停滞|次回.*kg|良い動き|ご予約がまだ入っていません/);
  assert.equal(JSON.stringify(store.getState()),before);
});
test('all exercises and left/right records survive',()=>{
  seed({exercises:Array.from({length:6},(_,i)=>exercise('種目'+i,5,i===5?'右':'左'))});
  const msg=lineMessage('test');assert.match(msg,/種目5：右 5kg×10回/);assert.match(msg,/種目0：左/);
});
test('symptoms and manually written guidance are not discarded to fit a length limit',()=>{
  seed({notes:{caution:'運動後にしびれが残りました',share:'帰宅後の様子も教えてください'},pain:7});
  const msg=lineMessage('test');assert.match(msg,/運動後にしびれが残りました/);assert.match(msg,/帰宅後の様子/);assert.match(msg,/医療機関/);assert.doesNotMatch(msg,/35kg×10回 →/);
});
test('RPE translated and pair recipient uses given name',()=>{
  seed({rpe:6,pair:true});const msg=lineMessage('test');assert.match(msg,/^利用者さん/);assert.match(msg,/きつさは10段階で6/);
});
test('written insight and next plan remain; saving and reloading does not change message',()=>{
  seed({notes:{insight:'最後まで動きが安定していました。',next:'次回は動きの確認から始めます。'}});
  const msg=lineMessage('test');store.load();assert.equal(lineMessage('test'),msg);assert.match(msg,/最後まで動きが安定/);assert.match(msg,/次回は動きの確認/);
});
