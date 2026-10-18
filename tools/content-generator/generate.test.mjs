import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, checkLiveApproval } from './generate.mjs';

const video = { prompt: 'Controlled motion', image: '../assets/keyframe.png', duration: 5, ratio: '720:1280' };
test('image uses documented default and one output', () => {
  const result = buildRequest('image', { prompt: 'Original visual' });
  assert.equal(result.payload.model, 'gpt-image-2.5-flare');
  assert.equal(result.payload.n, 1);
});
test('empty prompt rejected', () => assert.throws(() => buildRequest('image', { prompt: ' ' })));
test('unknown model rejected', () => assert.throws(() => buildRequest('image', { prompt: 'x', model: 'invented' })));
test('video needs approved keyframe', () => assert.throws(() => buildRequest('video', { ...video, image: '' })));
test('video duration validated', () => assert.throws(() => buildRequest('video', { ...video, duration: 80 })));
test('video aspect ratio validated', () => assert.throws(() => buildRequest('video', { ...video, ratio: 'auto' })));
test('generation estimate is 60 cents for five seconds', () => assert.equal(buildRequest('video', video).estimatedGenerationUsd, 0.6));
test('no live calls without explicit paid approval', () => assert.throws(() => checkLiveApproval(buildRequest('image', { prompt: 'x' }), [])));
test('video budget must cover estimate', () => assert.throws(() => checkLiveApproval(buildRequest('video', video), ['--approve-paid', '--max-usd=0.10'])));
test('video valid approval passes', () => assert.doesNotThrow(() => checkLiveApproval(buildRequest('video', video), ['--approve-paid', '--max-usd=0.60'])));
