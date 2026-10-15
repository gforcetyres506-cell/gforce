import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

const nativeRequire = createRequire(import.meta.url);

/** Execute the actual TypeScript helpers with isolated database/provider doubles.
 * No production test switches, external network or cloud credentials are used.
 */
export function loadSource(file, { db, fetch: fetchDouble, env = {}, modules = {} } = {}) {
  const cache = new Map();
  function load(path) {
    path = resolve(path);
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function require(specifier) {
      if (Object.hasOwn(modules, specifier)) return modules[specifier];
      if (specifier === 'server-only') return {};
      if (specifier === './supabase' || specifier === '@/lib/supabase') return {
        createServiceClient: () => { if (!db) throw new Error('Database unavailable'); return db; },
      };
      if (specifier.startsWith('@/')) return load(resolve('src', specifier.slice(2)) + '.ts');
      if (specifier.startsWith('.')) return load(resolve(dirname(path), specifier) + '.ts');
      return nativeRequire(specifier);
    }
    const fetch = fetchDouble ?? (() => { throw new Error('Unexpected external network'); });
    new Function('require', 'module', 'exports', 'process', 'fetch', 'AbortSignal', code)(
      require, module, module.exports, { env }, fetch, AbortSignal,
    );
    return module.exports;
  }
  return load(file);
}

export function databaseDouble(handler, rpcHandler = () => ({ data: null, error: { message: 'Missing RPC' } })) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, operation: 'read', filters: [] };
      calls.push(call);
      let proxy;
      proxy = new Proxy({}, {
        get(_target, name) {
          if (name === 'then') return (resolve, reject) => Promise.resolve().then(() => handler(call)).then(resolve, reject);
          return (...args) => {
            if (['insert', 'update', 'upsert', 'delete'].includes(name)) call.operation = name;
            call.filters.push([name, ...args]);
            return proxy;
          };
        },
      });
      return proxy;
    },
    async rpc(name, args) { calls.push({ rpc: name, args }); return rpcHandler(name, args); },
  };
}
