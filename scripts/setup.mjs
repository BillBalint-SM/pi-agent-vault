import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {createPlan, testedHostVersion, packageNames} from '../lib/profile.mjs';
import {applyPlan, rollback} from '../lib/transaction.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const {values} = parseArgs({options: {
    'agent-dir': {type: 'string'}, 'host-root': {type: 'string'},
    apply: {type: 'boolean'}, 'replace-instructions': {type: 'boolean'},
    rollback: {type: 'string'}, help: {type: 'boolean'}
  }});
  if (values.help) {
    console.log('node scripts/setup.mjs [--agent-dir DIR] [--host-root DIR] [--apply] [--replace-instructions]\nDefault is a read-only preview. --apply backs up and writes the managed profile.\nRollback: node scripts/setup.mjs --rollback PATH_TO_PRIVATE_MANIFEST');
  } else if (values.rollback) {
    if (values.apply || values['agent-dir'] || values['host-root']) throw new Error('Do not combine rollback with setup options.');
    console.log(JSON.stringify(rollback(root, values.rollback), null, 2));
  } else {
    const agentDir = path.resolve(values['agent-dir'] ?? process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi/agent'));
    const npmRoot = () => execSync('npm root -g', {encoding: 'utf8', timeout: 15000, windowsHide: true}).trim();
    const hostRoot = path.resolve(values['host-root'] ?? path.join(npmRoot(), '@earendil-works/pi-coding-agent'));
    const host = JSON.parse(fs.readFileSync(path.join(hostRoot, 'package.json'), 'utf8'));
    if (host.name !== '@earendil-works/pi-coding-agent' || host.version !== testedHostVersion) throw new Error(`Expected separately installed Pi ${testedHostVersion}; found ${host.name}@${host.version}. Pilot other versions before switching.`);
    if (!fs.existsSync(path.join(hostRoot, 'dist/index.js'))) throw new Error('Missing Pi host runtime.');
    const dependencies = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies;
    for (const name of [...packageNames, 'zod']) {
      const installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
      if (installed.version !== dependencies[name]) throw new Error(`Dependency mismatch: ${name}. Run npm ci --ignore-scripts --legacy-peer-deps.`);
    }
    const files = createPlan({root, agentDir, hostRoot});
    const report = {mode: values.apply ? 'apply' : 'preview-only', agentDir, hostVersion: host.version, targets: files.map(f => f.path), authAndSessions: 'not read or copied', networkRequests: 0};
    if (values.apply) Object.assign(report, applyPlan({root, agentDir, files, replaceInstructions: values['replace-instructions']}));
    console.log(JSON.stringify(report, null, 2));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
