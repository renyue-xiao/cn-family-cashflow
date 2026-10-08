import { copyFile, readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('addon', { recursive: true });
for (const name of ['README.md', 'LICENSE', 'UPSTREAM.md', 'CONTRIBUTING.md', 'qc-report.md'])
  await copyFile(name, 'addon/' + name);
await mkdir('addon/licenses', { recursive: true });
await copyFile(
  'vendor/wealthfolio-addon-sdk/LICENSE',
  'addon/licenses/wealthfolio-addon-sdk-MIT.txt',
);
const manifest = JSON.parse(await readFile('addon/manifest.json', 'utf8'));
if (manifest.main !== 'dist/addon.js') throw new Error('Unexpected addon entry');
execFileSync(
  'python3',
  [
    '-c',
    `from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path('addon')
with ZipFile('cn-family-cashflow-addon.zip','w',ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,p.relative_to(root))
`,
  ],
  { stdio: 'inherit' },
);
console.log(
  'Created cn-family-cashflow-addon.zip (manifest + ES module + CSS + documentation/licenses)',
);
