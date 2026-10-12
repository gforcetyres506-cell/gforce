import { writeFileSync } from 'node:fs';

// Fixed public origin and allowlisted paths only. No tokens, form submissions,
// customer records, bank data, response bodies or cookies are logged.
const origin='https://www.gforcetyres-mobile.co.uk';
const checks=[];
for(const path of ['/','/mobile-tyre-fitting','/how-it-works','/coverage','/contact','/guides/tyre-size','/robots.txt','/sitemap.xml']) {
  try {
    const started=performance.now();
    const r=await fetch(origin+path,{signal:AbortSignal.timeout(15000),redirect:'manual'});
    const body=await r.text();
    const html=!path.endsWith('.txt')&&!path.endsWith('.xml');
    const canonical=html&&body.includes('rel="canonical" href="'+origin+(path==='/'?'':path)+'"');
    const csp=r.headers.get('content-security-policy')??'';
    const headers=Boolean(csp.includes("frame-ancestors 'none'")&&r.headers.get('x-content-type-options')==='nosniff'&&r.headers.get('strict-transport-security'));
    const content=html?canonical:(path==='/sitemap.xml'?body.includes(origin+'/mobile-tyre-fitting')&&!/localhost|vercel\.app|\/manage\//i.test(body):body.includes('Sitemap: '+origin+'/sitemap.xml'));
    checks.push({path,status:r.status,latencyMs:Math.round(performance.now()-started),canonical:html?canonical:null,securityHeaders:headers,publicContent:content,pass:r.status===200&&content&&(!html||headers)});
  } catch {checks.push({path,status:0,pass:false,error:'NETWORK_OR_TLS_FAILURE'});}
}
const report={checkedAt:new Date().toISOString(),scope:'Read-only public HTTP/TLS/SEO checks; no DB/provider/application acceptance',origin,status:checks.every(c=>c.pass)?'PASS':'FAIL',checks};
if(process.argv.includes('--evidence')) writeFileSync('docs/launch/evidence/SHIP_LIVE_HEALTH.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS') process.exitCode=1;
