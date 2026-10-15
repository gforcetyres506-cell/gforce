import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Output counts and variable names only. Never print matched content or values.
const privateNames = ['SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','ONEAUTO_API_KEY','TURNSTILE_SECRET_KEY','VRM_CACHE_ENCRYPTION_KEY','PHASE1_ACCEPTANCE_TOKEN','PHASE1_DATABASE_URL'];
const values = privateNames.filter(n => process.env[n]?.length >= 8).map(n => [n,process.env[n]]);
function walk(dir) { return existsSync(dir) ? readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]) : []; }
const builtFiles = walk('.next/static').filter(f => /\.(?:js|map|json|html)$/.test(f));
const tracked = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const findings = [];
const patterns = [ /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/, /\b(?:sk_live_|sk_test_|re_)[a-zA-Z0-9]{24,}\b/ ];
for (const file of [...new Set([...builtFiles,...tracked.filter(f => /\.(?:ts|tsx|mjs|json|md|sql|env|txt)$/.test(f) || /(?:^|\/)\.env(?:\.|$)/.test(f))])]) {
  if (!existsSync(file) || file === 'scripts/launch-secret-scan.mjs') continue;
  const text = readFileSync(file,'utf8');
  for (const [name,value] of values) if (text.includes(value)) findings.push({ file, kind:'configured-secret-value', variable:name });
  // Reviewed baseline negative tests deliberately use the literal dummy
  // password "test-only". Exempt that exact fixture spelling, not the file.
  const patternText = file.replaceAll('\\','/') === 'tests/reliability/admin-boundary.test.mjs'
    ? text.replace(/postgres(?:ql)?:\/\/[^\s:@]+:test-only@/g,'TEST_ONLY_DATABASE_URL:') : text;
  if (patterns.some(p => p.test(patternText))) findings.push({ file, kind:'credential-pattern' });
  if (builtFiles.includes(file) && text.includes('SUPABASE_SERVICE_ROLE_KEY')) findings.push({ file,kind:'privileged-key-name-in-browser' });
}
// Scan actual patches in the task's release range, without printing matches.
const history = execFileSync('git',['log','-p','5ab984d050fed5c68fbb0f8eed5d04b2d37461cf..HEAD','--','.',':(exclude)package-lock.json'],{encoding:'utf8',maxBuffer:20*1024*1024});
const historyPatternCount = patterns.filter(p => p.test(history)).length;
for (const [name,value] of values) if (history.includes(value)) findings.push({ file:'release-history', kind:'configured-secret-value', variable:name });
const report = { checkedAt:new Date().toISOString(), builtBrowserFiles:builtFiles.length, sourceMaps:builtFiles.filter(f=>f.endsWith('.map')).length,
  configuredSecretNamesChecked:values.map(([n])=>n), findings, releaseHistoryPatternCount:historyPatternCount,
  status:builtFiles.length && !findings.length && !historyPatternCount ? 'PASS' : 'FAIL',
  scope:'Tracked working files, available private env values, built browser assets and task release history only. Not remote environment/account attestation or a full historical secret audit.' };
if (!process.argv.includes('--check-only')) {
  mkdirSync('docs/launch/evidence',{recursive:true});writeFileSync('docs/launch/evidence/SECRET_SCAN.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
if(report.status !== 'PASS') process.exitCode=1;
