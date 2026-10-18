import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const {values} = parseArgs({options: {'agent-dir': {type:'string'}, exercise: {type:'boolean'}, web: {type:'boolean'}}});
const agentDir = path.resolve(values['agent-dir'] ?? process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi/agent'));
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_OFFLINE = '1'; process.env.PI_TELEMETRY = '0';
const host = JSON.parse(fs.readFileSync(path.join(root, '.local/host.json'), 'utf8')).root;
const {createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager} = await import(pathToFileURL(path.join(host, 'dist/index.js')));
const cwd = path.join(root, '.local/verification-project'); fs.mkdirSync(cwd, {recursive:true});
const settingsManager = SettingsManager.create(cwd, agentDir);
const loader = new DefaultResourceLoader({cwd, agentDir, settingsManager});
await loader.reload();
const loaded = loader.getExtensions(); assert.deepEqual(loaded.errors, []);
assert.equal(loaded.extensions.length, 5);
assert(!loaded.extensions.some(e => /pi-lens/.test(e.path)));
const skills = loader.getSkills(); assert.equal(skills.skills.length, 2);
assert.deepEqual(new Set(skills.skills.map(s => s.name)), new Set(['browser-control', 'evidence-led-design']));
assert(skills.skills.every(s => s.filePath.replaceAll('\\','/').startsWith(root.replaceAll('\\','/'))));
assert.equal(loader.getPrompts().prompts.length, 0);
const {session} = await createAgentSession({cwd, agentDir, settingsManager, resourceLoader: loader, sessionManager: SessionManager.inMemory(cwd)});
const errors = []; const checks = ['resource allowlists']; const ownedTasks = [];
try {
  await session.bindExtensions({mode:'print', onError: e => errors.push(e)});
  const tools = session.getAllTools().map(t => t.name);
  const commands = session.extensionRunner.getRegisteredCommands().map(c => c.name);
  for (const name of ['todo','bg_run','bg_status','bg_kill','web_search','fetch_content','subagent']) assert(tools.includes(name), name);
  for (const name of ['bg_delegate','bg_run_pi_attested','fusion','fusion_research']) assert(!tools.includes(name), name);
  assert(commands.includes('simplify')); assert(!commands.includes('fusion')); assert(!commands.includes('claude-cache'));
  assert.deepEqual(session.extensionRunner.getCommandDiagnostics(), []);
  const ceilingApi = await import(pathToFileURL(path.join(root, 'node_modules/pi-subagents/src/api/capability-ceiling.js')));
  const ceiling = ceilingApi.resolveCurrentSubagentCapabilityCeiling(session.sessionManager.getSessionId());
  assert.deepEqual(ceiling.allowedAgents, ['pi-reviewer']);
  assert.deepEqual(new Set(ceiling.allowedTools), new Set(['read','grep','find','ls'])); assert.equal(ceiling.denyExtensions, true);
  checks.push('tool and command registration', 'session-scoped readonly subagent ceiling');
  const ctx = session.extensionRunner.createToolContext('portable-profile-pilot', new AbortController().signal);
  async function call(name, input) {
    if (!session.getActiveToolNames().includes(name)) session.setActiveTools([...session.getActiveToolNames(), name]);
    const def = session.extensionRunner.getToolDefinition(name);
    const args = def.prepareArguments ? def.prepareArguments(input) : input;
    const hook = await session.extensionRunner.emitToolCall({type:'tool_call', toolName:name, toolCallId:'portable-profile-pilot', input:args});
    if (hook?.block) return {isError:true, content:[{type:'text',text:hook.reason}]};
    try {return await def.execute('portable-profile-pilot', args, new AbortController().signal, undefined, ctx);}
    catch (error) {return {isError:true, error:String(error)};}
  }
  if (values.exercise) {
    assert.match(session.extensionRunner.getToolDefinition('todo').promptSnippet, /L2\/L3/);
    const create = await call('todo', {action:'create',subject:'Portable L2 profile verification fixture'}); assert(!create.isError);
    assert.match(JSON.stringify(await call('todo', {action:'list'})), /Portable L2 profile verification fixture/);
    await call('todo', {action:'clear'});
    assert.match(JSON.stringify(await call('subagent', {action:'list'})), /pi-reviewer/);
    const denied = await call('subagent', {agent:'worker',task:'Forbidden-agent negative test; must not spawn',async:false}); assert(denied.isError);
    const provider = await call('web_search', {query:'non-sensitive negative test',provider:'openai'});
    assert.match(JSON.stringify(provider), /not allowed|not permitted|allowlist|disabled/i);
    const task = await call('bg_run', {name:'Portable process pilot',command:'echo PI_PORTABLE_PROCESS_OK',isAgent:false,timeoutSeconds:10,notifyOnCompletion:false,triggerOnCompletion:false});
    assert(!task.isError); ownedTasks.push(task.details.task.id);
    // A bounded fixture delay, not an interactive agent wait loop. Exactly one terminal-state inspection follows.
    await new Promise(resolve => setTimeout(resolve, 2000));
    const terminal = await call('bg_status', {taskId:task.details.task.id}); assert.match(JSON.stringify(terminal), /completed/);
    assert.match(JSON.stringify(await call('bg_logs', {taskId:task.details.task.id,maxBytes:1000})), /PI_PORTABLE_PROCESS_OK/);
    ownedTasks.length = 0;
    checks.push('todo create/list/clear', 'forbidden subagent rejected without model call', 'forbidden search provider rejected', 'real echo background process and output');
  }
  if (values.web) {
    const page = await call('fetch_content', {url:'https://www.iana.org/help/example-domains'});
    assert(!page.isError); assert.match(JSON.stringify(page), /Example Domains|example domains/);
    checks.push('public IANA page direct HTTP extraction');
  }
  assert.deepEqual(errors, []);
  const report = {status:'PASS',hostVersion:'1.3.0',checks,extensionPaths:loaded.extensions.map(e => e.path),skills:skills.skills.map(s => s.filePath),commands,tools,ceiling,lifecycleErrors:errors,modelCalls:0,networkFixture:values.web ? 'IANA HTTP extraction only' : 'no requested network fixture',notTested:['interactive TUI','completion-driven model wake-up','reload survival','real child model invocation','other operating systems']};
  const out = path.join(root, '.local/verification/latest.json'); fs.mkdirSync(path.dirname(out), {recursive:true}); fs.writeFileSync(out, JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  for (const taskId of ownedTasks) {
    try {await session.extensionRunner.getToolDefinition('bg_kill').execute('portable-cleanup',{taskId},new AbortController().signal,undefined,session.extensionRunner.createToolContext('portable-cleanup',new AbortController().signal));} catch {}
  }
  await session.extensionRunner.emit({type:'session_shutdown',reason:'quit'}); session.dispose();
}
