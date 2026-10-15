import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { boundedPerformanceEvidence } from './lib/bounded-performance-evidence.mjs';

// Isolated lab only. API fixtures below never reach hosted persistence and
// never constitute business data, hosted E2E, real-device or field-INP proof.
const origin = 'http://127.0.0.1:3111';
const dir = 'docs/launch/evidence';
mkdirSync(dir, { recursive: true });
const tyre = { id:'00000000-0000-4000-8000-000000000001',brand:'Lab only',model:'Lab tyre',sku:'lab',width:225,profile:45,rim:18,tier:'standard',season:'summer',sell_price:10000,stock:4,active:true };
const slot = {id:'00000000-0000-4000-8000-000000000003',slot_date:'2030-01-02',start_time:'10:00:00',end_time:'12:00:00',max_bookings:2,available:true,remaining:2,active:true};
const report = { checkedAt:new Date().toISOString(), sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), buildId:readFileSync('.next/BUILD_ID','utf8').trim(), scope:'LOOPBACK LAB ONLY; reduced-motion narrow Chromium viewports, trusted keyboard/click events, browser API fixtures; no submissions, external DB/provider calls, physical device or field INP proof', samples:[], webkit:null };
const browser = await chromium.launch();
try {
  for (const width of (process.argv.includes('--mobile-only') ? [390] : [360,375,390,430,768,1366,1440])) {
    for (let attempt=0;attempt<(width===390 ? 3 : 1);attempt++) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      if (width===390) {
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
        await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      }
      await page.addInitScript(() => {
        window.lab={events:[],longTasks:[],frames:[],lcpMs:null,shifts:[]};
        new PerformanceObserver(list=>{for(const e of list.getEntries()) window.lab.events.push({name:e.name,start:e.startTime,duration:e.duration,interactionId:e.interactionId,inputDelay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart,presentation:e.startTime+e.duration-e.processingEnd,target:e.target?.id||e.target?.getAttribute?.('aria-label')||e.target?.tagName});}).observe({type:'event',buffered:true,durationThreshold:16});
        new PerformanceObserver(list=>{for(const e of list.getEntries()) window.lab.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
        new PerformanceObserver(list=>{for(const e of list.getEntries()) window.lab.lcpMs=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
        new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) window.lab.shifts.push({start:e.startTime,value:e.value});}).observe({type:'layout-shift',buffered:true});
        if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) new PerformanceObserver(list=>{for(const e of list.getEntries()) window.lab.frames.push({start:e.startTime,duration:e.duration,renderStart:e.renderStart,styleAndLayoutStart:e.styleAndLayoutStart,scripts:e.scripts.map(s=>({source:s.sourceURL,fn:s.sourceFunctionName,invoker:s.invoker,duration:s.duration,forcedLayout:s.forcedStyleAndLayoutDuration}))});}).observe({type:'long-animation-frame',buffered:true});
      });
      await page.route('**/api/**',async route=>{
        const path=new URL(route.request().url()).pathname;
        let body={ok:false};
        if(path==='/api/tyres') body={ok:true,data:[tyre]};
        if(path==='/api/postcode/check') body={ok:true,covered:true,data:{zone:{id:'lab',postcode_prefix:'E14',zone_name:'Lab only',callout_charge:0,active:true}}};
        if(path==='/api/slots') body={ok:true,data:[slot]};
        if(path==='/api/checkout/quote') { const items=route.request().postDataJSON().items;const total=items.reduce((n,i)=>n+i.quantity*10000,0);body={ok:true,data:{lines:items.map(i=>({...i,label:'Lab only',unit_price:10000,line_total:i.quantity*10000})),tyres_total:total,fitting_fee:1700,callout_charge:0,total_amount:total+1700,deposit_amount:total+1700,balance_due:0}}; }
        await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
      });
      const actions=[];
      const action=async(name,fn)=>{const start=await page.evaluate(()=>performance.now());await fn();await page.waitForTimeout(200);actions.push({name,start,end:await page.evaluate(()=>performance.now())});};
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      if(process.argv.includes('--light-paint')) await page.addStyleTag({content:'* { filter:none !important; box-shadow:none !important; transition:none !important; animation:none !important; }'});
      await action('finder keyboard',async()=>{await page.getByLabel('Fitting postcode').pressSequentially('E14 8PX',{delay:90});await page.keyboard.press('Tab');});
      if(width<1024) {
        await action('menu open',()=>page.getByRole('button',{name:'Open navigation menu'}).click());
        await action('menu close',()=>page.getByRole('button',{name:'Close navigation menu'}).click());
      }
      await action('manual open',()=>page.getByRole('button',{name:'Enter it manually'}).click());
      for(const [label,value,steps] of [['Width','225',8],['Profile','45',4],['Rim','18',5]]) await action('manual '+label,async()=>{
        const select=page.getByLabel(label,{exact:true});
        await select.press('Home');
        for(let n=0;n<steps;n++) await select.press('ArrowDown',{delay:60});
        await select.press('Enter');
        assert.equal(await select.inputValue(),value);
      });
      assert.equal(await page.getByRole('button',{name:'Show Available Tyres'}).isEnabled(),true);
      const home=await page.evaluate(()=>window.lab);
      home.actions=[...actions];
      home.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      await page.goto(origin+'/booking?tyre='+tyre.id+'&w=225&p=45&r=18&pc=E14%208PX',{waitUntil:'networkidle'});
      actions.length=0;
      await page.getByRole('heading',{name:tyre.model}).waitFor();
      await action('quantity increase',()=>page.getByRole('button',{name:'Increase tyre quantity',exact:true}).click());
      await action('booking step 2',()=>page.getByRole('button',{name:'Continue to Location & Vehicle'}).click());
      await action('booking step 3',()=>page.getByRole('button',{name:'Choose Fitting Slot'}).click());
      await action('slot selection',()=>page.getByRole('button',{name:/10am.*12pm/}).click());
      await action('booking step 4',()=>page.getByRole('button',{name:'Enter Contact Details'}).click());
      await action('customer keyboard',()=>page.getByLabel('Full Name').pressSequentially('Lab Only',{delay:90}));
      const booking=await page.evaluate(()=>window.lab);
      booking.actions=[...actions];
      booking.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      const summarize=data=>({lcpMs:data.lcpMs,layoutShiftSum:data.shifts.reduce((n,e)=>n+e.value,0),maxInteractionMs:Math.max(0,...data.events.filter(e=>e.interactionId>0).map(e=>e.duration)),...data});
      report.samples.push({width,attempt,throttled:width===390,home:summarize(home),booking:summarize(booking)});
      console.log(JSON.stringify({width,attempt,homeMax:report.samples.at(-1).home.maxInteractionMs,bookingMax:report.samples.at(-1).booking.maxInteractionMs,lcp:home.lcpMs}));
      await context.close();
    }
  }
} finally { await browser.close(); }
try {
  const browser=await webkit.launch();
  try {const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(origin,{waitUntil:'networkidle'});await page.getByLabel('Fitting postcode').fill('Lab');await page.getByRole('button',{name:'Enter it manually'}).click();await page.getByLabel('Width',{exact:true}).selectOption('205');await page.getByLabel('Profile',{exact:true}).selectOption('55');await page.getByLabel('Rim',{exact:true}).selectOption('16');assert(await page.getByRole('button',{name:'Show Available Tyres'}).isEnabled());report.webkit={status:'PASS',scope:'Local WebKit manual finder smoke; no Safari hardware or hosted persistence'};} finally {await browser.close();}
} catch {report.webkit={status:'BLOCKED',reason:'WebKit finder smoke did not complete; inspect cross-browser acceptance separately'};}
report.fieldINP='BLOCKED: lab events cannot establish real-user p75 INP';
report.paintAblation=process.argv.includes('--light-paint');
const mobile=report.samples.filter(s=>s.throttled);
report.labTargets={
  throttledSamples:mobile.length,
  homeLcpMs:mobile.map(s=>s.home.lcpMs),
  maxInteractionMs:mobile.map(s=>Math.max(s.home.maxInteractionMs,s.booking.maxInteractionMs)),
  maxLayoutShiftSum:Math.max(0,...report.samples.flatMap(s=>[s.home.layoutShiftSum,s.booking.layoutShiftSum])),
  note:'Lab LCP, interaction maxima and layout-shift sums only; no field percentile claim',
};
report.functionalStatus=report.samples.every(s=>!s.home.overflow&&!s.booking.overflow)&&report.webkit.status==='PASS'?'PASS':'FAIL';
mkdirSync('.local-postgres',{recursive:true});
writeFileSync('.local-postgres/ship-performance'+(report.paintAblation?'-paint':'')+'-full.json',JSON.stringify(report,null,2)+'\n');
writeFileSync(dir+(report.paintAblation?'/SHIP_PAINT_DIAGNOSTIC.json':'/SHIP_PERFORMANCE.json'),JSON.stringify(boundedPerformanceEvidence(report),null,2)+'\n');
console.log(JSON.stringify({samples:report.samples.length,webkit:report.webkit}));
if(report.functionalStatus!=='PASS') process.exitCode=1;
