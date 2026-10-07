import assert from 'node:assert/strict';import { readFile } from 'node:fs/promises';
const manifest=JSON.parse(await readFile('addon/manifest.json','utf8'));
const enable=(await import('../addon/dist/addon.js')).default;
assert.equal(typeof enable,'function');let route,cleanup;
await enable({router:{add:r=>{route=r;}},onDisable:cb=>{cleanup=cb;}});
assert.equal(route.id,manifest.contributes.routes[0].id);assert.equal(route.path,'/addons/'+manifest.id);assert.equal(typeof route.component,'function');assert.equal(typeof cleanup,'function');cleanup();
assert.deepEqual(manifest.permissions.map(p=>p.category),['accounts','portfolio','alternative-assets','files']);
const code=await readFile('addon/dist/addon.js','utf8');assert.ok(!code.includes('/Users/'));assert.ok(!code.includes('createRoot('));
console.log('Addon built module imported; original enable registered manifest route and cleanup against context stub. This is not a live Wealthfolio install.');
