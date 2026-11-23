import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The dual build emits .js files with ESM *syntax* into both dirs; the
// per-directory package.json below tells Node which module system each uses.
const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cjsDir = join(pkgRoot, 'dist', 'cjs');
const esmDir = join(pkgRoot, 'dist', 'esm');

mkdirSync(cjsDir, { recursive: true });
mkdirSync(esmDir, { recursive: true });
writeFileSync(join(cjsDir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
writeFileSync(join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
