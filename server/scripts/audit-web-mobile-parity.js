#!/usr/bin/env node
/* Read-only static inventory for MOB-GAP-1. It never imports application code. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes:true }).flatMap(entry => {
  const relative = path.posix.join(dir, entry.name);
  return entry.isDirectory() ? (entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : walk(relative)) : [relative];
});

const serverSource = read('server/server.js');
const imports = new Map([...serverSource.matchAll(/const\s+(\w+)\s*=\s*require\(['"](\.\/routes\/[^'"]+)['"]\)/g)].map(m => [m[1], `server/${m[2].replace('./','')}.js`]));
const mounts = [...serverSource.matchAll(/app\.use\(['"]([^'"]+)['"]\s*,\s*(\w+)\)/g)].map(m => ({ basePath:m[1], symbol:m[2], file:imports.get(m[2]) || null }));
const backendRoutes = [];
for (const mount of mounts) {
  if (!mount.file || !fs.existsSync(path.join(root,mount.file))) continue;
  const source = read(mount.file);
  for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,([\s\S]*?)(?=\n\s*router\.|\n\s*module\.exports)/g)) {
    const chain = match[3].replace(/\s+/g,' ').trim().slice(0,500);
    backendRoutes.push({ method:match[1].toUpperCase(), path:`${mount.basePath}${match[2]}`.replace(/\/+/g,'/'), routeFile:mount.file, authenticated:/\b(protect|auth|gestionLocativeOnly|hotelAccess)\b/.test(chain), roles:[...chain.matchAll(/restrictTo\(([^)]+)\)/g)].flatMap(x => [...x[1].matchAll(/['"]([^'"]+)['"]/g)].map(y=>y[1])), handlerChain:chain });
  }
}

const webRoutes = walk('client/app').filter(f=>/\/page\.(js|jsx|ts|tsx)$/.test(f)).map(file=>({ file, route:'/'+file.replace(/^client\/app\/?/,'').replace(/\/page\.(js|jsx|ts|tsx)$/,'').replace(/\(.*?\)\//g,'').replace(/^page$/,'') })).sort((a,b)=>a.route.localeCompare(b.route));
const mobileScreens = walk('altimmo-app/src/screens').filter(f=>/\.(js|jsx|ts|tsx)$/.test(f)&&!f.includes('/__tests__/'));
const navigationFiles = walk('altimmo-app/src/navigation').filter(f=>/\.(js|jsx|ts|tsx)$/.test(f));
const registered = [];
for (const file of navigationFiles) for (const m of read(file).matchAll(/<(?:Stack|Tab)\.Screen\s+name=['"]([^'"]+)['"][\s\S]*?component=\{(\w+)\}/g)) registered.push({ name:m[1], component:m[2], navigationFile:file });
const importedComponents = new Map();
for (const file of navigationFiles) for (const m of read(file).matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g)) importedComponents.set(m[1], path.posix.normalize(path.posix.join(path.posix.dirname(file),m[2]))+'.jsx');
for (const row of registered) row.screenFile = importedComponents.get(row.component) || null;
const registeredFiles = new Set(registered.map(r=>r.screenFile));
const mobileApiCalls = [];
for (const file of walk('altimmo-app/src').filter(f=>/\.(js|jsx|ts|tsx)$/.test(f)&&!f.includes('/__tests__/'))) {
  for (const m of read(file).matchAll(/api\.(get|post|put|patch|delete)\s*\(\s*([`'"])(.*?)\2/g)) mobileApiCalls.push({ method:m[1].toUpperCase(), endpoint:m[3], file });
}
const output = {
  generatedAt:new Date().toISOString(), methodology:'static inventory plus manual audit; no application modules imported',
  counts:{ backendRoutes:backendRoutes.length, backendMounts:mounts.length, webRoutes:webRoutes.length, mobileScreenFiles:mobileScreens.length, mobileRegisteredRoutes:registered.length, mobileApiCalls:mobileApiCalls.length },
  backendMounts:mounts, backendRoutes, webRoutes, mobileNavigation:registered,
  mobileUnregisteredScreenFiles:mobileScreens.filter(file=>!registeredFiles.has(file)), mobileApiCalls,
};
fs.writeFileSync(path.join(root,'server/docs/MOB_GAP_INVENTORY.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.counts));
