import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildRequest(kind, brief) {
  if (!brief || typeof brief.prompt !== 'string' || !brief.prompt.trim()) {
    throw new Error('A nonempty prompt is required.');
  }
  if (kind === 'image') {
    const model = brief.model ?? 'gpt-image-2.5-flare';
    if (!['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'].includes(model)) {
      throw new Error('Unreviewed image model. Review documentation before adding it.');
    }
    return { provider: 'openai', payload: { model, prompt: brief.prompt, n: 1 } };
  }
  if (kind === 'video') {
    const model = brief.model ?? 'gen4.5';
    if (!['gen4.5', 'gen4_turbo'].includes(model)) throw new Error('Unreviewed video model.');
    if (![5, 10].includes(brief.duration)) throw new Error('Duration must be 5 or 10 seconds.');
    if (!['720:1280', '1280:720'].includes(brief.ratio)) throw new Error('Unsupported video ratio.');
    if (typeof brief.image !== 'string' || !brief.image.trim()) {
      throw new Error('An approved local PNG/JPEG/WebP keyframe is required.');
    }
    return {
      provider: 'runway',
      estimatedGenerationUsd: brief.duration * (model === 'gen4.5' ? 0.12 : 0.05),
      estimateSource: 'https://docs.dev.runwayml.com/guides/pricing/',
      payload: { model, promptText: brief.prompt, ratio: brief.ratio, duration: brief.duration },
      localImage: brief.image,
    };
  }
  throw new Error('Kind must be image or video.');
}

export function checkLiveApproval(plan, flags) {
  if (!flags.includes('--approve-paid')) throw new Error('Live calls require --approve-paid.');
  if (plan.provider === 'runway') {
    const budget = Number(flags.find(x => x.startsWith('--max-usd='))?.split('=')[1]);
    if (!Number.isFinite(budget) || budget < plan.estimatedGenerationUsd) {
      throw new Error('Provide --max-usd=N covering the estimated generation cost.');
    }
  }
}

async function main() {
  const [kind, input, ...flags] = process.argv.slice(2);
  if (!input || flags.some(x => x !== '--live' && x !== '--approve-paid' && !x.startsWith('--max-usd='))) {
    throw new Error('Usage: node generate.mjs image|video brief.json [--live --approve-paid --max-usd=N]');
  }
  const inputPath = path.resolve(input);
  const brief = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const plan = buildRequest(kind, brief);
  if (!flags.includes('--live')) {
    console.log(JSON.stringify({ mode: 'dry-run', networkCalls: 0, ...plan }, null, 2));
    return;
  }
  checkLiveApproval(plan, flags);
  const keyName = plan.provider === 'openai' ? 'OPENAI_API_KEY' : 'RUNWAYML_API_SECRET';
  if (!process.env[keyName]) throw new Error(`Missing ${keyName}. Never paste keys into chat.`);
  let imageData;
  if (plan.localImage) {
    const imagePath = path.resolve(path.dirname(inputPath), plan.localImage);
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(imagePath).toLowerCase()];
    if (!mime) throw new Error('Unsupported keyframe format.');
    const image = await fs.readFile(imagePath);
    if (image.length > 5 * 1024 * 1024) throw new Error('Keyframe exceeds local conservative 5 MiB limit.');
    imageData = `data:${mime};base64,${image.toString('base64')}`;
  }
  const runDir = path.resolve('runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}`);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, 'request.json'), JSON.stringify({ ...plan, warning: 'Prompts may contain private information. Keep runs local.' }, null, 2));
  if (kind === 'image') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ maxRetries: 0, timeout: 180000 });
    const result = await client.images.generate(plan.payload);
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('No base64 image returned; inspect the documented response. Do not retry blindly.');
    await fs.writeFile(path.join(runDir, 'image.png'), Buffer.from(b64, 'base64'));
    await fs.writeFile(path.join(runDir, 'result.json'), JSON.stringify({ requestId: result._request_id, usage: result.usage }, null, 2));
    console.log(`Saved image: ${path.join(runDir, 'image.png')}`);
  } else {
    const { default: RunwayML } = await import('@runwayml/sdk');
    const client = new RunwayML({ maxRetries: 0 });
    const task = await client.imageToVideo.create({ ...plan.payload, promptImage: imageData });
    await fs.writeFile(path.join(runDir, 'task.json'), JSON.stringify(task, null, 2));
    console.log(`Submitted task ${task.id}. Status: ${task.status}. Task saved in ${runDir}`);
    console.log('No second generation or automatic polling. Retrieve the existing task using its ID.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    console.error('If a live request timed out, it may still have been charged. Check the provider before resubmitting.');
    process.exitCode = 1;
  });
}
