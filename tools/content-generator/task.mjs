// Read an existing Runway task. Never creates a generation.
const id = process.argv[2];
if (!id || !/^[a-zA-Z0-9-]{10,100}$/.test(id)) {
  console.error('Usage: node task.mjs TASK_ID');
  process.exitCode = 1;
} else if (!process.env.RUNWAYML_API_SECRET) {
  console.error('Missing RUNWAYML_API_SECRET. Never paste it into chat.');
  process.exitCode = 1;
} else {
  try {
    const { default: RunwayML } = await import('@runwayml/sdk');
    const client = new RunwayML({ maxRetries: 0 });
    const result = await client.tasks.retrieve(id);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
