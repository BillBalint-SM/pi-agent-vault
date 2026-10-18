import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const maybe = (...args) => {try {return git(...args);} catch {return null;}};
const remote = maybe('remote', 'get-url', 'origin');
const safeRemote = value => {try {const u = new URL(value); u.username = ''; u.password = ''; return u.toString();} catch {return value;}};
const upstream = maybe('rev-parse', '--abbrev-ref', '@{upstream}');
const counts = upstream ? maybe('rev-list', '--left-right', '--count', 'HEAD...@{upstream}')?.split(/\s+/).map(Number) : null;
console.log(JSON.stringify({
  branch: git('branch', '--show-current'), localCommit: git('rev-parse', 'HEAD'),
  commitTime: git('log', '-1', '--format=%cI'),
  workingTree: git('status', '--porcelain=v1', '--untracked-files=normal').split('\n').filter(Boolean),
  origin: remote ? safeRemote(remote) : null, upstream,
  aheadOfLastFetchedRemote: counts?.[0] ?? null, behindLastFetchedRemote: counts?.[1] ?? null,
  remoteKnowledge: 'Local fetched refs only; no network, fetch, commit or push was performed. Working-tree changes are not included in the last local commit.'
}, null, 2));
