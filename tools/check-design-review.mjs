import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kinds = new Set(['source', 'technical', 'rendered', 'interaction', 'user-study', 'field', 'experiment']);
const criticalAreas = ['brand', 'primary-task', 'rendered-quality', 'accessibility', 'content-and-rights'];
const evidenceSupports = {
  implementation: ['source', 'technical'],
  appearance: ['rendered'],
  behavior: ['interaction'],
  'user-understanding': ['user-study'],
  'observed-metric': ['field', 'experiment'],
  'causal-impact': ['experiment'],
};

export function validate(review) {
  const errors = [];
  if (!review || typeof review !== 'object') return ['Review must be an object.'];
  for (const key of ['artifact', 'revision', 'audience', 'task', 'medium', 'hypothesis', 'strongestObjection', 'nextTest']) {
    if (typeof review[key] !== 'string' || !review[key].trim() || review[key].includes('REPLACE:')) errors.push(`Complete ${key}.`);
  }
  for (const key of ['sources', 'checks', 'claims', 'limitations']) {
    if (!Array.isArray(review[key])) errors.push(`${key} must be an array.`);
  }
  if (!review.sources?.length) errors.push('Include relevant source references.');
  if (typeof review.productionReady !== 'boolean') errors.push('productionReady must be boolean.');
  if (!['not-requested', 'pending', 'accepted', 'rejected'].includes(review.ownerApproval)) errors.push('Invalid ownerApproval.');
  if (!['not-published', 'published'].includes(review.publication)) errors.push('Invalid publication.');
  const checks = Array.isArray(review.checks) ? review.checks : [];
  for (const area of criticalAreas) {
    if (checks.filter(c => c?.area === area).length !== 1) errors.push(`Include exactly one ${area} check.`);
  }
  function inspectEvidence(items, context) {
    if (!Array.isArray(items)) { errors.push(`${context}: evidence must be an array.`); return []; }
    for (const e of items) {
      if (!e || !kinds.has(e.kind) || !e.reference || !e.conditions || !e.observation) errors.push(`${context}: evidence needs valid kind, reference, conditions and observation.`);
    }
    return items.filter(Boolean);
  }
  for (const check of checks) {
    if (!check || !['pass', 'fail', 'not-tested', 'not-applicable'].includes(check.status)) { errors.push('Invalid check status.'); continue; }
    const evidence = inspectEvidence(check.evidence, check.area);
    if (check.status === 'pass' && !evidence.length) errors.push(`${check.area}: pass requires evidence.`);
    if (check.status === 'not-applicable' && !check.reason) errors.push(`${check.area}: explain why not applicable.`);
    if (review.productionReady && !['pass', 'not-applicable'].includes(check.status)) errors.push(`${check.area}: unresolved check blocks productionReady.`);
  }
  for (const claim of Array.isArray(review.claims) ? review.claims : []) {
    if (!claim || !claim.statement || !Object.hasOwn(evidenceSupports, claim.type)) { errors.push('Invalid claim.'); continue; }
    const evidence = inspectEvidence(claim.evidence, claim.type);
    if (!evidence.some(e => evidenceSupports[claim.type].includes(e.kind))) errors.push(`${claim.type}: evidence class does not support this claim.`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node check-design-review.mjs review.json');
    const errors = validate(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('Report structure checks passed. This is NOT a visual-quality, accessibility or impact certification. Evidence content was not independently verified.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
