import assert from 'node:assert/strict';
import test from 'node:test';
const memory = new Map();
globalThis.localStorage = {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const store = await import('../next/core/store.js?v=21');
const meta = await import('../next/core/meta.js?v=21');
const { buildNextMenu, planToExercises, patternOf } = await import('../next/features/next-menu.js');

const ex = (name, weight, reps, n=3) => ({ name, sets: Array.from({length:n}, () => ({ weight, reps })) });
function seed({ goal='', attention='', sessions=[], events=[] } = {}){
  memory.clear(); meta.setMeta({ calendarEvents: events }); store.load();
  store.upsertClient({ id:'c1', name:'山田 花子', goal, attention, active:true });
  sessions.forEach((s, i) => store.saveSession({ id:'s'+i, clientId:'c1', notes:{}, ...s }));
}
const find = (plan, name) => plan.exercises.find(e => e.name === name);

test('patterns', () => {
  assert.equal(patternOf('ベンチプレス'), 'hpush');
  assert.equal(patternOf('シーテッドロー'), 'hpull');
  assert.equal(patternOf('ラットプルダウン'), 'vpull');
  assert.equal(patternOf('レッグカール'), 'hip');
  assert.equal(patternOf('ブルガリアンスクワット'), 'knee');
  assert.equal(patternOf('片脚立ち（秒）'), 'single');
});

test('double progression: top of range -> add weight, reset reps; otherwise add reps', () => {
  seed({ goal:'筋肥大', sessions:[
    { date:'2026-11-01', exercises:[ex('スクワット',60,12), ex('ベンチプレス',40,9), ex('シーテッドロー',35,10), ex('ルーマニアンデッドリフト',50,10), ex('プランク','自重',30,2)] }
  ]});
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.equal(p.level, 'ok');
  const sq = find(p,'スクワット');
  assert.deepEqual(sq.sets.map(s=>[s.weight,s.reps]), [[65,8],[65,8],[65,8]]);
  assert.equal(find(p,'ベンチプレス').sets[0].reps, 11);
  assert.equal(find(p,'ベンチプレス').sets[0].weight, 40);
  assert.equal(sq.role, 'main');
});

test('volume cap keeps total within +10%', () => {
  seed({ goal:'筋肥大', sessions:[{ date:'2026-11-01', exercises:[ex('スクワット',100,12), ex('レッグプレス',150,12), ex('シーテッドロー',30,10), ex('プランク','自重',30,2)] }]});
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  const vol = list => list.reduce((a,e)=>a+e.sets.reduce((b,s)=>b+(s.weight==='自重'?0:s.weight*s.reps),0),0);
  assert.ok(vol(p.exercises) <= (100*12*3+150*12*3+30*10*3)*1.1 + 1);
});

test('pain >= 7 -> no menu', () => {
  seed({ sessions:[{ date:'2026-11-01', pain:8, exercises:[ex('スクワット',40,10)] }]});
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.equal(p.level, 'stop'); assert.equal(p.exercises.length, 0);
});

test('knee pain 5 -> hold weights and replace squat', () => {
  seed({ attention:'右膝に違和感', sessions:[{ date:'2026-11-01', pain:5, exercises:[ex('スクワット',40,15), ex('ベンチプレス',30,15)] }]});
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.equal(p.level, 'careful');
  assert.ok(find(p,'ボックススクワット（浅め）'));
  assert.ok(!find(p,'スクワット'));
  assert.equal(find(p,'ベンチプレス').sets[0].weight, 30);
});

test('blank >= 14 days -> 85% and one set fewer', () => {
  seed({ sessions:[{ date:'2026-10-01', exercises:[ex('スクワット',60,10)] }]});
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  const sq = find(p,'スクワット');
  assert.equal(sq.sets.length, 2); assert.equal(sq.sets[0].weight, 51);
});

test('past scheduled sessions without records count for frequency and gap, not for loads', () => {
  const events = ['2026-10-15','2026-10-22','2026-10-29','2026-11-05'].map(d => ({ summary:'山田 花子 パーソナル', start:d+'T10:00:00' }));
  seed({ sessions:[{ date:'2026-10-08', exercises:[ex('スクワット',40,12), ex('シーテッドロー',30,12), ex('ヒップリフト','自重',15,2), ex('バードドッグ','自重',10,2)] }], events });
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.equal(p.estimated, 4);
  assert.equal(p.gap, 2);                       // last scheduled session, not the last record
  assert.ok(!p.reasons.some(r => r.includes('ブランク')));
  assert.equal(find(p,'スクワット').sets[0].weight, 40);  // loads still judged from the real record
  assert.ok(p.reasons.some(r => r.includes('記録がない回が4回')));
});

test('push heavy -> adds a pull; health goal adds balance; data untouched', () => {
  seed({ goal:'健康維持', sessions:[{ date:'2026-11-01', exercises:[ex('ベンチプレス',20,12), ex('ショルダープレス',8,12), ex('スクワット','自重',12), ex('ヒップリフト','自重',12), ex('プランク','自重',30,2)] }]});
  const before = JSON.stringify(store.getState());
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.ok(find(p,'シーテッドロー'));
  assert.ok(find(p,'片脚立ち（秒）'));
  assert.ok(p.home.length > 0);
  assert.equal(JSON.stringify(store.getState()), before);
  assert.equal(planToExercises(p).length, p.exercises.length);
});

test('two misses in a row -> drop 10%; RPE 9 -> careful hold', () => {
  const s = (d, done, rpe=8) => ({ date:d, rpe, exercises:[{ id:'e'+d, ...ex('ベンチプレス',50,8) }], done: { ['e'+d]: done } });
  seed({ goal:'筋肥大', sessions:[s('2026-10-18',[0,1,2]), s('2026-10-25',[0,1]), s('2026-11-01',[0,1])] });
  assert.equal(buildNextMenu('c1', { until:'2026-11-07' }).exercises[0].sets[0].weight, 45);
  seed({ goal:'筋肥大', sessions:[s('2026-10-25',[0,1]), s('2026-11-01',[0,1],9)] });
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.equal(p.level, 'careful'); assert.equal(p.exercises[0].sets[0].weight, 50);
});

test('plateau (same setting x3, latest missed) -> swap to same-pattern variant, weight from its history or 0', () => {
  const s = (d, done) => ({ date:d, rpe:8, exercises:[{ id:'e'+d, ...ex('ベンチプレス',50,8) }], done: { ['e'+d]: done } });
  seed({ goal:'筋肥大', sessions:[s('2026-10-18',[0,1,2]), s('2026-10-25',[0,1,2]), s('2026-11-01',[0,1])] });
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  const v = find(p,'インクラインダンベルプレス');
  assert.ok(v); assert.equal(v.sets[0].weight, 0); assert.equal(v.change, 'swap');
});

test('schedule fill: pending -> apply -> marked, excluded from loads, undo to trash', async () => {
  const fill = await import('../next/features/schedule-fill.js');
  const events = ['2026-10-15','2026-10-22','2026-11-12'].map(d => ({ summary:'山田 花子 パーソナル', start:d+'T10:00:00' }))
    .concat([{ summary:'山田 花子 ケア', start:'2026-10-29T10:00:00' }]);
  seed({ sessions:[{ date:'2026-10-08', exercises:[ex('スクワット',40,12)] }], events });
  const pend = fill.pendingFills('2026-11-07');
  assert.deepEqual(pend.map(p=>p.date), ['2026-10-15','2026-10-22']);   // future and ケア excluded
  assert.equal(fill.applyFills(pend), 2);
  assert.equal(fill.pendingFills('2026-11-07').length, 0);
  const saved = store.sessions({ clientId:'c1' });
  assert.equal(saved.length, 3);
  assert.equal(saved.filter(s=>s.source==='schedule').length, 2);
  assert.equal(saved[0].exercises[0].sets[0].weight, 40);
  const p = buildNextMenu('c1', { until:'2026-11-07' });
  assert.equal(p.gap, 16); assert.equal(p.estimated, 2);
  assert.equal(fill.undoFills(), 2);
  assert.equal(store.sessions({ clientId:'c1' }).length, 1);
  assert.equal(fill.pendingFills('2026-11-07').length, 2);
});
