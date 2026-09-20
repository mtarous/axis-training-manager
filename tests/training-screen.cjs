// Run with NODE_PATH pointing to installed Playwright; uses only synthetic data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.AXIS_CHROME_PATH || undefined,args:['--no-sandbox']});
 const page = await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto(process.env.AXIS_TEST_URL || 'http://127.0.0.1:8777');
 const seed = async()=>{ 
   if(process.env.AXIS_TEST_FONT_CSS){
     const fs=require('node:fs'),path=require('node:path'),source=process.env.AXIS_TEST_FONT_CSS;
     const css=fs.readFileSync(source,'utf8').replace(/url\(([^)]+)\)/g,(_,u)=>'url(data:font/woff2;base64,'+fs.readFileSync(path.resolve(path.dirname(source),u.replace(/['"]/g,''))).toString('base64')+')');
     await page.addStyleTag({content:css+'body{font-family:"Noto Sans JP",sans-serif!important}'});
   }
   return page.evaluate(()=>{
   BASE=[{date:'2026-09-01',client:'テスト利用者A',exercise:'ベンチプレス',weight:50,reps:10,sets:3,source:'既存記録'}, {date:'2026-09-01',client:'テスト利用者A',exercise:'スクワット',weight:40,reps:10,sets:3,source:'既存記録'}];
   META={};$('#lock').style.display='none';$('#app').style.display='block';$('#bottom').style.display='grid';
   renderInput(draft||{client:'テスト利用者A',date:'2026-09-20',rpe:'8',status:'要確認',insight:'テストメモ',exercises:[{exercise:'ベンチプレス',weight:60,weightStep:.5,reps:10,sets:3,done:[]},{exercise:'スクワット',weight:40,weightStep:1,reps:8,sets:2,done:[]}]});show('input');
 });};
 await seed();
 assert.equal(await page.evaluate(()=>currentDraft().rpe),'8');
 assert.equal(await page.evaluate(()=>currentDraft().status),'要確認');
 await page.getByRole('button',{name:'+0.5',exact:true}).click();
 assert.equal(await page.evaluate(()=>exs[0].weight),60.5);
 await page.getByRole('button',{name:'✓ このセットを記録する',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>exs[0].done),[0]);
 await page.getByRole('button',{name:'▶ 休憩スタート',exact:true}).click();
 await page.waitForTimeout(1100);
 assert.equal(await page.locator('#v16RestLabel').textContent(),'休憩中');
 assert.ok(Number(await page.locator('#v16RestArc').evaluate(el=>el.style.strokeDashoffset))>0);
 await page.getByRole('button',{name:'›',exact:true}).click();
 assert.equal(await page.evaluate(()=>activeExerciseIndex),1);
 assert.equal(await page.locator('#v16RestLabel').textContent(),'休憩中');
 await page.getByRole('button',{name:'‹',exact:true}).click();
 await page.getByRole('button',{name:'直前の完了を取り消す'}).click();
 assert.deepEqual(await page.evaluate(()=>exs[0].done),[]);
 await page.getByRole('button',{name:'✓ このセットを記録する',exact:true}).click();
 await page.getByRole('button',{name:'気づき',exact:false}).click();
 await page.locator('#finsight').fill('架空データの保存確認');
 await page.reload();await seed();
 assert.equal(await page.evaluate(()=>currentDraft().rpe),'8');
 assert.equal(await page.evaluate(()=>currentDraft().status),'要確認');
 assert.equal(await page.evaluate(()=>exs[0].weight),60.5);
 assert.deepEqual(await page.evaluate(()=>exs[0].done),[0]);
 assert.equal(await page.locator('#finsight').inputValue(),'架空データの保存確認');
 await page.getByText('履歴を表示（1件）',{exact:true}).click();
 assert.ok(await page.getByText('2026-09-01 · 50 × 10回 × 3セット',{exact:true}).isVisible());
 for (const width of [375,390,430,900]) {
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{scrollTo(0,0)});
 await page.evaluate(()=>document.fonts.ready);
 await page.setViewportSize({width:390,height:await page.evaluate(()=>document.documentElement.scrollHeight)});
 await page.screenshot({path:'/tmp/axis-training-mobile.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'セッション終了',exact:true}).click();
 assert.equal(await page.evaluate(()=>added.length),1);
 assert.equal(await page.evaluate(()=>added[0].rpe),'8');
 assert.equal(await page.evaluate(()=>getSession40State().startedAt),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('axis_training_draft')),null);
 assert.equal(await page.evaluate(()=>BASE[0].weight),50);
 assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: controls, set undo, rest ring, navigation, draft reload, history, 375–900px layout, save and clock reset; no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
