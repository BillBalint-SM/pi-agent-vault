import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {packageNames} from '../lib/profile.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean);
const problems = [];
const forbidden = /(^|\/)(node_modules|\.local|\.pi|sessions|runs|browser-profiles|logs)(\/|$)|(^|\/)auth\.json$|(^|\/)\.env(?:\.|$)|\.(pem|key|sqlite|bundle|tgz|zip)$/i;
for (const relative of files) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue; // Old tracked documentation files are intentionally deleted.
  if (forbidden.test(relative)) { problems.push(`${relative}: private/generated path must not be tracked`); continue; }
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 1024 * 1024) { problems.push(`${relative}: unexpected link or large/binary artifact`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('\0')) problems.push(`${relative}: unexpected binary content`);
  if (/[A-Z]:[\\/]Users[\\/]|\/home\/(?!<)[a-zA-Z0-9_-]+\/|\/Users\/(?!<)[a-zA-Z0-9_-]+\//.test(text)) problems.push(`${relative}: hardcoded personal home path`);
  if (/sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) problems.push(`${relative}: possible credential`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
for (const name of [...packageNames, 'zod']) {
  if (!/^\d+\.\d+\.\d+$/.test(manifest.dependencies[name])) problems.push(`Unpinned dependency: ${name}`);
  if (lock.packages[`node_modules/${name}`]?.version !== manifest.dependencies[name]) problems.push(`Lockfile version mismatch: ${name}`);
}
if (lock.packages['node_modules/@earendil-works/pi-coding-agent']) problems.push('Host Pi must be installed separately, not duplicated as an extension dependency.');
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log('Portable-source checks passed (paths, selected secret patterns, excluded artifacts and exact direct dependency locks). Not a complete security/privacy audit; inspect the outgoing diff too.');
