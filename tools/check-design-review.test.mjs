import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './check-design-review.mjs';

const evidence = kind => ({ kind, reference: 'local/test-artifact', conditions: 'Recorded test conditions', observation: 'Recorded observation' });
function draft() {
  return {
    artifact: 'local/prototype.html', revision: 'test-revision', audience: 'Hypothesis: prospective coaching clients',
    task: 'Find the contact action', medium: 'web', hypothesis: 'A clearer action may help discovery; test actual task completion.',
    sources: ['Canonical project DESIGN.md'],
    checks: ['brand', 'primary-task', 'rendered-quality', 'accessibility', 'content-and-rights'].map(area => ({ area, status: 'not-tested', evidence: [] })),
    claims: [], strongestObjection: 'The wording may still be unclear.', limitations: ['No user study.'],
    nextTest: 'Inspect rendered mobile composition.', productionReady: false, ownerApproval: 'not-requested', publication: 'not-published',
  };
}
test('honest untested draft passes report structure', () => assert.deepEqual(validate(draft()), []));
test('pass requires evidence', () => { const r = draft(); r.checks[0].status = 'pass'; assert.ok(validate(r).some(e => e.includes('pass requires evidence'))); });
test('unresolved checks block ready status', () => { const r = draft(); r.productionReady = true; assert.ok(validate(r).some(e => e.includes('blocks productionReady'))); });
test('screenshot cannot support causal impact', () => { const r = draft(); r.claims.push({ type: 'causal-impact', statement: 'Conversion improved because of the design.', evidence: [evidence('rendered')] }); assert.ok(validate(r).some(e => e.includes('does not support'))); });
test('technical test cannot establish user understanding', () => { const r = draft(); r.claims.push({ type: 'user-understanding', statement: 'Target users understood the offer.', evidence: [evidence('technical')] }); assert.ok(validate(r).some(e => e.includes('does not support'))); });
test('recorded interaction supports scoped behavior claim', () => { const r = draft(); r.claims.push({ type: 'behavior', statement: 'In the recorded desktop test Escape closed the menu.', evidence: [evidence('interaction')] }); assert.deepEqual(validate(r), []); });
test('not applicable needs reason', () => { const r = draft(); r.checks[0].status = 'not-applicable'; assert.ok(validate(r).some(e => e.includes('not applicable'))); });
test('missing critical area is rejected', () => { const r = draft(); r.checks.pop(); assert.ok(validate(r).some(e => e.includes('content-and-rights'))); });
test('placeholders are rejected', () => { const r = draft(); r.artifact = 'REPLACE: artifact'; assert.ok(validate(r).some(e => e.includes('Complete artifact'))); });
