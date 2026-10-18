import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {profileFiles} from './profile.mjs';

const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const existing = file => fs.existsSync(file) ? fs.readFileSync(file) : null;
const digest = value => value === null ? null : hash(value);
function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, content, {flag: 'wx', mode: 0o600});
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function restoreEntry(entry) {
  if (entry.before === null) { if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path); }
  else writeAtomic(entry.path, Buffer.from(entry.before, 'base64'));
}

export function applyPlan({root, agentDir, files, replaceInstructions = false}) {
  const instructions = files.find(f => f.path === path.join(agentDir, 'AGENTS.md'));
  const oldInstructions = existing(instructions.path)?.toString('utf8');
  if (oldInstructions && oldInstructions !== instructions.content && !oldInstructions.startsWith('# Portable Pi workspace\n') && !replaceInstructions) {
    throw new Error('Existing AGENTS.md is not managed by this vault. Review it, then use --replace-instructions explicitly; a private backup will be kept.');
  }
  const entries = files.map(file => ({path: file.path, before: existing(file.path), content: Buffer.from(file.content)}))
    .filter(file => digest(file.before) !== hash(file.content));
  if (!entries.length) return {changed: 0, snapshot: null};
  const directory = path.join(root, '.local/backups', `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${crypto.randomUUID().slice(0,8)}`);
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const snapshot = path.join(directory, 'manifest.json');
  const manifest = {schemaVersion: 1, status: 'prepared', root, agentDir, entries: entries.map(e => ({path: e.path, before: e.before?.toString('base64') ?? null, afterSha256: hash(e.content)}))};
  writeAtomic(snapshot, JSON.stringify(manifest, null, 2));
  const written = [];
  try {
    for (const e of entries) { writeAtomic(e.path, e.content); written.push(e.path); }
    manifest.status = 'applied';
    writeAtomic(snapshot, JSON.stringify(manifest, null, 2));
  } catch (error) {
    // Restore only writes from this transaction; never sweep unrelated files.
    for (const e of manifest.entries.toReversed()) if (written.includes(e.path)) restoreEntry(e);
    manifest.status = 'restored-after-error';
    writeAtomic(snapshot, JSON.stringify(manifest, null, 2));
    throw error;
  }
  return {changed: entries.length, snapshot};
}

export function rollback(root, snapshot) {
  root = path.resolve(root); snapshot = path.resolve(snapshot);
  const relative = path.relative(path.join(root, '.local/backups'), snapshot);
  if (relative.startsWith('..') || path.isAbsolute(relative) || path.basename(snapshot) !== 'manifest.json') throw new Error('Rollback must use this vault\'s private backup manifest.');
  const manifest = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  if (path.resolve(manifest.root) !== root || manifest.schemaVersion !== 1) throw new Error('Wrong vault or snapshot schema.');
  if (manifest.status.startsWith('restored')) return {status: 'already-restored', changed: 0};
  if (manifest.status !== 'applied') throw new Error('Snapshot was not fully applied; inspect before recovery.');
  const allowed = new Set([...profileFiles.map(f => path.resolve(manifest.agentDir, f)), path.join(root, '.local/host.json')]);
  for (const e of manifest.entries) {
    if (!allowed.has(path.resolve(e.path))) throw new Error('Unexpected rollback target.');
    if (digest(existing(e.path)) !== e.afterSha256) throw new Error(`Refusing to overwrite changes made after setup: ${e.path}`);
  }
  for (const e of manifest.entries.toReversed()) restoreEntry(e);
  manifest.status = 'restored';
  writeAtomic(snapshot, JSON.stringify(manifest, null, 2));
  return {status: 'restored', changed: manifest.entries.length};
}
