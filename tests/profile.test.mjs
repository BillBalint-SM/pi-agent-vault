import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlan, renderSettings, packageNames} from '../lib/profile.mjs';
import {applyPlan, rollback} from '../lib/transaction.mjs';
const source = fileURLToPath(new URL('../', import.meta.url));

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-vault-test-'));
  t.after(() => fs.rmSync(base, {recursive: true, force: true}));
  const root = path.join(base, 'new PC with spaces', 'pi', 'vault');
  const agentDir = path.join(base, 'different home', '.pi', 'agent');
  fs.mkdirSync(root, {recursive: true}); fs.mkdirSync(agentDir, {recursive: true});
  fs.cpSync(path.join(source, 'config'), path.join(root, 'config'), {recursive: true});
  return {root, agentDir, hostRoot: path.join(base, 'host install'), home: path.join(base, 'different home')};
}
function bytes(file) {return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;}

test('portable settings allow exactly six package roots, five extensions and two skills', t => {
  const f = fixture(t); const s = renderSettings(f.root, f.agentDir, f.home);
  assert.equal(s.packages.length, 6); assert.equal(packageNames.length, 6);
  assert.equal(s.extensions.filter(p => p.startsWith('+')).length, 5);
  assert.equal(s.skills.filter(p => p.startsWith('+')).length, 2);
  assert.deepEqual(s.packages.find(p => p.source.endsWith('/pi-lens')).extensions, []);
  for (const p of s.packages) {assert.deepEqual(p.skills, []); assert.deepEqual(p.prompts, []); assert.deepEqual(p.themes, []);}
  assert(s.extensions.includes('!**')); assert(s.skills.includes('!**'));
  assert.equal(s.defaultProjectTrust, 'never');
  assert.deepEqual(s.subagents.modelScope.allow, ['inherit']);
  assert(!JSON.stringify(s).includes(source.replaceAll('\\', '/')));
});

test('plan is read-only; applying preserves unrelated preferences, auth and sessions', t => {
  const f = fixture(t);
  const settings = {defaultProvider: 'example-provider', defaultModel: 'machine-choice', customPreference: {keep: true}, extensions: ['old-extension']};
  fs.writeFileSync(path.join(f.agentDir, 'settings.json'), JSON.stringify(settings));
  const auth = path.join(f.agentDir, 'auth.json'); const session = path.join(f.agentDir, 'sessions', 'private.jsonl');
  fs.mkdirSync(path.dirname(session)); fs.writeFileSync(auth, 'LOCAL-AUTH-SENTINEL'); fs.writeFileSync(session, 'LOCAL-SESSION-SENTINEL');
  const files = createPlan(f);
  assert.equal(fs.existsSync(path.join(f.root, '.local')), false);
  assert.equal(fs.existsSync(path.join(f.agentDir, 'AGENTS.md')), false);
  const result = applyPlan({...f, files}); assert.equal(result.changed, 6);
  const actual = JSON.parse(bytes(path.join(f.agentDir, 'settings.json')));
  assert.equal(actual.defaultProvider, settings.defaultProvider); assert.equal(actual.defaultModel, settings.defaultModel);
  assert.deepEqual(actual.customPreference, {keep: true});
  assert.equal(bytes(auth), 'LOCAL-AUTH-SENTINEL'); assert.equal(bytes(session), 'LOCAL-SESSION-SENTINEL');
  assert(!bytes(result.snapshot).includes('LOCAL-AUTH-SENTINEL'));
  assert(!bytes(result.snapshot).includes('LOCAL-SESSION-SENTINEL'));
  assert.equal(applyPlan({...f, files: createPlan(f)}).changed, 0);
});

test('existing unmanaged instructions require explicit replacement and survive rollback byte-for-byte', t => {
  const f = fixture(t); const file = path.join(f.agentDir, 'AGENTS.md');
  const original = '# Existing user instructions\r\nDo not lose these.\r\n'; fs.writeFileSync(file, original);
  const files = createPlan(f);
  assert.throws(() => applyPlan({...f, files}), /replace-instructions/);
  assert.equal(bytes(file), original); assert.equal(fs.existsSync(path.join(f.root, '.local')), false);
  const result = applyPlan({...f, files, replaceInstructions: true});
  assert.equal(rollback(f.root, result.snapshot).status, 'restored');
  assert.equal(bytes(file), original);
  assert.equal(fs.existsSync(path.join(f.agentDir, 'settings.json')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.local/host.json')), false);
  assert.equal(rollback(f.root, result.snapshot).status, 'already-restored');
});

test('rollback refuses newer edits before changing any profile files', t => {
  const f = fixture(t); const result = applyPlan({...f, files: createPlan(f)});
  const file = path.join(f.agentDir, 'web-search.json'); fs.appendFileSync(file, ' ');
  const before = bytes(path.join(f.agentDir, 'AGENTS.md'));
  assert.throws(() => rollback(f.root, result.snapshot), /after setup/);
  assert.equal(bytes(path.join(f.agentDir, 'AGENTS.md')), before);
  assert.equal(bytes(file).endsWith(' '), true);
});

test('rollback rejects manifests outside the private backup directory', t => {
  const f = fixture(t);
  assert.throws(() => rollback(f.root, path.join(f.root, 'fake.json')), /private backup/);
});

test('JSON rendering survives spaces, non-ASCII and OS-supported quoted paths', t => {
  const f = fixture(t); const segment = process.platform === 'win32' ? 'idézet' : 'idézet"';
  f.root = path.join(f.root, segment);
  fs.mkdirSync(f.root, {recursive: true}); fs.cpSync(path.join(source, 'config'), path.join(f.root, 'config'), {recursive: true});
  const files = createPlan(f);
  for (const file of files.filter(f => f.path.endsWith('.json'))) assert.doesNotThrow(() => JSON.parse(file.content));
  const sub = JSON.parse(files.find(f => f.path.endsWith('subagent/config.json') || f.path.endsWith('subagent\\config.json')).content);
  assert(sub.defaultSessionDir.includes(segment));
});
