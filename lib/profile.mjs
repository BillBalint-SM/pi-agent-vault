import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const testedHostVersion = '1.3.0';
export const packageNames = ['pi-web-access', 'pi-background-tasks', '@juicesharp/rpiv-todo', 'pi-simplify', 'pi-lens', 'pi-subagents'];
export const profileFiles = ['settings.json', 'AGENTS.md', 'web-search.json', 'extensions/subagent/config.json', 'pi-vault.json'];
export const portable = value => value.replaceAll('\\', '/');
const json = value => JSON.stringify(value, null, 2) + '\n';

export function renderSettings(root, agentDir, home = os.homedir()) {
  const base = portable(path.resolve(root));
  const ext = ['web-access.ts', 'background-process.ts', 'todo-l2-l3.ts', 'restricted-subagents.ts'].map(f => `${base}/extensions/${f}`);
  const simplify = `${base}/node_modules/pi-simplify/dist/index.js`;
  const skills = ['browser-control', 'evidence-led-design'].map(n => `${base}/skills/${n}/SKILL.md`);
  return {
    packages: packageNames.map(name => ({source: `${base}/node_modules/${name}`, extensions: name === 'pi-simplify' ? ['dist/index.js'] : [], skills: [], prompts: [], themes: []})),
    extensions: [`${base}/extensions`, '!**', '-builtin:mcp', '-builtin:llama.cpp', '-builtin:codemode', '-builtin:tool-search', ...ext.map(f => '+' + f), '+' + simplify],
    subagents: {
      disableBuiltins: true,
      agentScanDirs: [`${base}/agents`],
      agentExcludeDirs: [portable(path.join(home, '.agents')), portable(path.join(agentDir, 'agents'))],
      defaultExtensions: [], defaultSubagentOnlyExtensions: [],
      modelScope: {enforce: true, strict: true, allow: ['inherit']},
      watchdog: {enabled: false, children: {enabled: false}}
    },
    skills: [...skills, '!**', ...skills.map(f => '+' + f)],
    prompts: ['!**'], themes: ['!**'], enableSkillCommands: true, defaultProjectTrust: 'never'
  };
}

function replaceRoot(value, root) {
  if (typeof value === 'string') return value.replaceAll('{{ROOT}}', portable(root));
  if (Array.isArray(value)) return value.map(v => replaceRoot(v, root));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, replaceRoot(v, root)]));
  return value;
}

export function createPlan({root, agentDir, hostRoot, home = os.homedir()}) {
  root = path.resolve(root); agentDir = path.resolve(agentDir);
  const settingsPath = path.join(agentDir, 'settings.json');
  const current = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('Existing settings must be a JSON object.');
  // Keep machine/provider/model preferences; replace only this profile's owned policy/resource keys.
  const settings = {...current, ...renderSettings(root, agentDir, home)};
  const readConfig = name => replaceRoot(JSON.parse(fs.readFileSync(path.join(root, 'config', name + '.json'), 'utf8')), root);
  const prefix = portable(root);
  return [
    {path: settingsPath, content: json(settings)},
    {path: path.join(agentDir, 'AGENTS.md'), content: `# Portable Pi workspace\n\nCanonical vault: ${prefix}\n\nBefore substantive work, read these files completely:\n- ${prefix}/AGENTS.md\n- ${prefix}/working-policy.md\n- ${prefix}/state/CURRENT.md\n\nFollow applicable project instructions as well. All shared Pi rules, skills, wrappers and configuration sources live in this vault. Maintain its meaningful state after durable changes and before handoff. Credentials and personal sessions stay local and are not part of this restore.\n\nFor design/marketing work first read ${prefix}/skills/evidence-led-design/SKILL.md and its linked framework. Preserve the owning project's canonical design authority.\n`},
    {path: path.join(agentDir, 'web-search.json'), content: json(readConfig('web-search'))},
    {path: path.join(agentDir, 'extensions/subagent/config.json'), content: json(readConfig('subagents'))},
    {path: path.join(agentDir, 'pi-vault.json'), content: json({schemaVersion: 1, root: prefix, testedHostVersion})},
    {path: path.join(root, '.local/host.json'), content: json({root: portable(path.resolve(hostRoot)), version: testedHostVersion})}
  ];
}
