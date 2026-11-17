// Rebuild js/vendor/three.module.min.js with only the three.js classes the game uses (smaller download).
// Run after using a THREE class that isn't in the bundle yet (the game would throw "X is not a constructor"):
//   cd /tmp && npm i three@0.165.0 esbuild && node <project>/tools/build_three.mjs <project>
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const root = path.resolve(process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
const require = createRequire(path.join(process.cwd(), 'x.js')); const esbuild = require('esbuild');
const names = new Set(), skip = new Set(['BufferGeometryUtils', 'GLTFLoader']);   // mentioned only in vendor comments
for (const dir of ['js', 'js/vendor']) for (const f of fs.readdirSync(path.join(root, dir))) {
  if (!f.endsWith('.js') || /three\.module|gsap|meshopt/.test(f)) continue; const s = fs.readFileSync(path.join(root, dir, f), 'utf8');
  for (const m of s.matchAll(/\bTHREE\.([A-Za-z_]\w*)/g)) names.add(m[1]);
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]three['"]/g)) m[1].split(',').map(x => x.trim().split(' as ')[0]).filter(Boolean).forEach(n => names.add(n)); }
skip.forEach(n => names.delete(n));
const r = await esbuild.build({ stdin: { contents: `export { ${[...names].sort().join(', ')} } from 'three';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', minify: true, target: 'es2020', legalComments: 'none', write: false });
const out = path.join(root, 'js/vendor/three.module.min.js');
fs.writeFileSync(out, '/* three.js r165 (MIT), trimmed to the classes this game uses. Rebuild with tools/build_three.mjs. */\n' + r.outputFiles[0].text);
console.log(names.size, 'classes ->', out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
