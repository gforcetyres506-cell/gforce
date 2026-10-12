import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Called only inside the runner-created native disposable cluster, after the
// audited Gate 4 fixture journey. No supplied cloud URL or production reset.
const url = new URL(process.env.GATE2_TEST_DATABASE_URL ?? 'http://missing.invalid');
assert.equal(url.hostname,'127.0.0.1');
const directory=resolve(process.env.GATE2_LOCAL_DATA_DIR ?? 'missing');
assert(directory.startsWith(resolve('.local-postgres') + (process.platform==='win32'?'\\':'/')));
const source=new pg.Client({connectionString:url.toString()});
await source.connect();
let target;
try {
  assert.equal(resolve((await source.query("select current_setting('data_directory') d")).rows[0].d),directory);
  const tables=(await source.query("select schemaname,tablename from pg_tables where schemaname in ('public','auth') order by 1,2")).rows;
  async function fingerprint(db) {
    const contents=[];
    for(const t of tables) {
      const table='"'+t.schemaname+'"."'+t.tablename+'"';
      // Store only hashes/counts; neither backup bytes nor customer/bank fields
      // appear in tracked evidence or command output.
      const rows=(await db.query(`select row_to_json(t)::text r from ${table} t order by row_to_json(t)::text`)).rows.map(r=>r.r);
      contents.push({table:t.schemaname+'.'+t.tablename,count:rows.length,sha256:createHash('sha256').update(rows.join('\n')).digest('hex')});
    }
    return contents;
  }
  const before=await fingerprint(source);
  const checks=async(db)=>{
    const results=await db.query(readFileSync('supabase/verification/phase1_catalog_checks.sql','utf8'));
    const rows=results.flatMap(r=>r.rows??[]).filter(r=>'result' in r);
    assert(rows.length>=8);assert(rows.every(r=>r.result==='PASS'));
    return rows.length;
  };
  await checks(source);
  const backup=join(directory,'rehearsal.dump');
  const exe=name=>join(process.env.GATE2_POSTGRES_BIN,name+(process.platform==='win32'?'.exe':''));
  const run=(name,args)=>{const r=spawnSync(exe(name),args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Local '+name+' failed; inspect ignored local database directory');};
  const started=performance.now();
  run('pg_dump',['--host=127.0.0.1','--port='+url.port,'--username=postgres','--dbname=postgres','--format=custom','--file='+backup]);
  const backupMs=performance.now()-started;
  const restoreStart=performance.now();
  await source.query('create database ship_restore');
  run('pg_restore',['--host=127.0.0.1','--port='+url.port,'--username=postgres','--dbname=ship_restore','--exit-on-error',backup]);
  const dest=new URL(url);dest.pathname='/ship_restore';target=new pg.Client({connectionString:dest.toString()});await target.connect();
  assert.deepEqual(await fingerprint(target),before,'Restored row contents must exactly match');
  const catalogueChecks=await checks(target);
  const result={checkedAt:new Date().toISOString(),status:'PASS',scope:'LOCAL native PostgreSQL only; fresh loopback cluster; Gate 4 audited fixtures; minimal Auth stand-in; no hosted backup, Storage or provider acceptance',migrations:18,tables:before.length,rows:before.reduce((n,t)=>n+t.count,0),catalogueChecks,exactDataHashesMatch:true,backupSha256:createHash('sha256').update(readFileSync(backup)).digest('hex'),backupMs:Math.round(backupMs),restoreAndVerificationMs:Math.round(performance.now()-restoreStart),hostedRestore:'BLOCKED: authorized disposable credentials and provider backup unavailable',productionRTO:'UNKNOWN: local timings are not a production recovery guarantee',productionRPO:'UNKNOWN: provider backup retention/schedule not attested'};
  writeFileSync('docs/launch/evidence/SHIP_LOCAL_RESTORE.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally {await target?.end();await source.end();}
