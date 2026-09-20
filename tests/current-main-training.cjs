// AXIS TRAINING current-main regression smoke test
// Safe by design: synthetic data only, service worker blocked, no production decrypt/write.
// Run locally with Playwright after starting a static server for this branch.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE = [
  {date:"2026-09-10",client:"DUMMY_TEST",exercise:"ベンチプレス",weight:40,reps:10,sets:3,achieved:"完了",memo:"RPE:7",source:"既存記録"}
];

(async()=>{
  const url=process.env.AXIS_TEST_URL || "http://127.0.0.1:8000/";
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:"domcontentloaded"});

  // Never use data.enc/calendar.enc in this test. Seed synthetic state in page memory.
  await page.evaluate((base)=>{
    localStorage.removeItem("axis_training_draft");
    localStorage.removeItem("axis_training_added");
    window.clientList=()=>[{name:"DUMMY_TEST"}];
    window.latest=()=>({rows:[{exercise:"ベンチプレス",weight:40,reps:10,sets:3}]});
    window.META={goals:{},attention:{},schedule:[],calendarEvents:[]};
    window.added=[];
    document.querySelector("#lock").style.display="none";
    document.querySelector("#app").style.display="block";
    document.querySelector("#bottom").style.display="grid";
    renderAll();
    renderInput({date:"2026-09-21",client:"DUMMY_TEST",status:"良好",rpe:7,pain:0,
      exercises:[{exercise:"ベンチプレス",weight:40,reps:10,sets:3,done:[]}],
      insight:"DUMMY",caution:"",share:"",next:""});
    show("input");
  },BASE);

  assert.equal(await page.locator("#fclient").inputValue(),"DUMMY_TEST");
  assert.equal(await page.locator("#frpe").inputValue(),"7");
  assert.equal(await page.locator("#fstatus").inputValue(),"良好");

  await page.getByRole("button",{name:"＋0.5"}).click();
  assert.match(await page.locator(".ax16t-metric").first().innerText(),/40\.5/);

  await page.getByRole("button",{name:"このセットを記録する"}).click();
  assert.match(await page.locator(".ax16t-settitle").innerText(),/1\/3/);

  await page.getByRole("button",{name:"休憩スタート"}).click();
  await page.waitForTimeout(1100);
  assert.ok(await page.locator("#timerText").count());

  // Draft survives redraw/reload path.
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem("axis_training_draft")||"null"));
  assert.ok(draft,"draft should exist");
  assert.equal(draft.client,"DUMMY_TEST");

  // Responsive overflow smoke checks.
  for(const width of [375,390,430,900]){
    await page.setViewportSize({width,height:844});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    assert.equal(overflow,false,`horizontal overflow at ${width}px`);
  }

  assert.deepEqual(errors,[]);
  console.log("PASS current-main training smoke");
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});