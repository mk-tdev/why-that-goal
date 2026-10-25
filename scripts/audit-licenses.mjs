#!/usr/bin/env node
// No package execution or new dependencies. Audit the exact lock and preserve upstream notices.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockBytes = readFileSync(join(root, 'package-lock.json'));
const lock = JSON.parse(lockBytes);
const write = process.argv.includes('--write');
const approved = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', '0BSD', 'MPL-2.0']);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const files = new Map(), rows = [];
const priorPath = join(root, 'docs/evaluations/dependency-licenses.json');
const prior = existsSync(priorPath) ? JSON.parse(readFileSync(priorPath)).entries : [];
for (const [path, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  if (!path) continue;
  const name = path.split('node_modules/').at(-1);
  if (!approved.has(entry.license)) throw new Error(`Review required: ${name} license ${entry.license}`);
  // Native optional packages share the corresponding upstream release's notices. This also
  // covers lock entries for other platforms without downloading or executing their binaries.
  const family = name.startsWith('@esbuild/') ? 'esbuild' :
    name.startsWith('@rolldown/binding-') ? 'rolldown' :
    name.startsWith('lightningcss-') ? 'lightningcss' : null;
  const source = family ? `node_modules/${family}` : path;
  const directory = join(root, source);
  if (!existsSync(directory)) {
    const cached = prior.find((r) => r.path === path && r.version === entry.version &&
      r.license === entry.license && r.integrity === entry.integrity && r.resolved === entry.resolved);
    if (!entry.optional || !cached) throw new Error(`Install full dependencies / review optional notice: ${source}`);
    for (const notice of cached.notices) {
      const text = readFileSync(join(root, notice.path), 'utf8');
      if (sha(text) !== notice.sha256) throw new Error(`Changed optional notice: ${notice.path}`);
      files.set(notice.path, text);
    }
    rows.push(cached);
    continue;
  }
  const pkg = JSON.parse(readFileSync(join(directory, 'package.json')));
  if (pkg.version !== entry.version || pkg.license !== entry.license)
    throw new Error(`Lock / installed license-version mismatch: ${path}`);
  const notices = readdirSync(directory).filter((f) => /^(licen[cs]e|copying|notice|copyright|third.?party)/i.test(f));
  if (!notices.some((f) => /^licen[cs]e/i.test(f))) throw new Error(`Missing license text: ${name}`);
  const id = `${pkg.name.replaceAll('/', '__').replace('@', '')}@${pkg.version}`;
  const noticeFiles = [];
  for (const notice of notices.sort()) {
    const output = `third_party/licenses/${id}--${notice}.txt`;
    const text = readFileSync(join(directory, notice), 'utf8');
    files.set(output, text);
    noticeFiles.push({ path: output, sha256: sha(text) });
  }
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  rows.push({ path, name, version: entry.version, license: entry.license,
    developmentOnly: !!entry.dev, optional: !!entry.optional, resolved: entry.resolved,
    integrity: entry.integrity, noticeSource: source, sharedReleaseNotices: !!family,
    upstream: repo ?? null, notices: noticeFiles });
}
const counts = {};
for (const r of rows) counts[r.license] = (counts[r.license] ?? 0) + 1;
const report = { schemaVersion: 1, lockfileSha256: sha(lockBytes), packages: rows.length,
  licenseCounts: counts, unresolved: 0,
  scope: 'All locked npm entries including transitive and optional platform packages. Native variants use same-version upstream release notices. Build-only MPL tooling is unmodified; source location is in THIRD_PARTY_NOTICES.md. Embedded upstream third-party notices are preserved verbatim, not individually reclassified. Base-image OS packages remain governed by their in-image copyright files.',
  entries: rows };
files.set('docs/evaluations/dependency-licenses.json', JSON.stringify(report, null, 2) + '\n');
let publicNotice = `WHY THAT GOAL? — THIRD-PARTY NOTICES\n\nSource and full audit: https://github.com/mk-tdev/why-that-goal/blob/main/THIRD_PARTY_NOTICES.md\n${rows.length} locked npm entries, including development and optional platform packages.\nThese licenses apply to their respective components, not to the original application as a whole.\nNative platform variants use their same-version upstream project's license/notice files.\nLightning CSS (MPL-2.0) is an unmodified build tool, not shipped in the pruned runtime or browser bundle.\nSource: https://github.com/parcel-bundler/lightningcss/tree/v1.33.0\n\nPACKAGE INVENTORY\n`;
for (const r of rows) publicNotice += `${r.name}@${r.version} | ${r.license} | ${r.developmentOnly ? 'development' : 'runtime'} | ${r.notices.map((n) => n.path).join(', ')}\n`;
for (const [path, text] of [...files].filter(([p]) => p.startsWith('third_party/')))
  publicNotice += `\n\n${'='.repeat(78)}\n${path}\n${'='.repeat(78)}\n${text}\n`;
for (const font of ['DM-Sans-OFL.txt', 'Barlow-Condensed-OFL.txt']) {
  const text = readFileSync(join(root, 'third_party/fonts', font), 'utf8');
  if (!text.includes('SIL OPEN FONT LICENSE Version 1.1')) throw new Error(`Invalid font notice: ${font}`);
  publicNotice += `\n\n${'='.repeat(78)}\nFONT: ${font} (loaded from Google Fonts; no font binary vendored)\n${text}\n`;
}
files.set('public/third-party-notices.txt', publicNotice);
for (const [path, text] of files) {
  const target = join(root, path);
  if (write) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); }
  else if (!existsSync(target) || readFileSync(target, 'utf8') !== text)
    throw new Error(`Stale/missing ${path}; run npm run audit:licenses -- --write and review changes`);
}
console.log(JSON.stringify({ packages: rows.length, licenseCounts: counts, unresolved: 0,
  noticeFiles: files.size, mode: write ? 'updated' : 'verified' }));
