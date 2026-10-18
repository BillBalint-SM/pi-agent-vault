# Optional content API adapter – offline by default

Reusable code from the earlier local content project; brand files, private briefs, assets and run results are deliberately not included. No live provider integration or generated visual quality is validated here. Model identifiers and pricing assumptions are historical: re-read current provider documentation before any live use.

```sh
node generate.mjs image examples/image.json
node generate.mjs video examples/video.json
node --test generate.test.mjs
```

These commands validate and print a plan without importing SDKs, making network requests or generating charges. The video example points to an intentionally absent, not-yet-approved keyframe. The root vault check runs these ten offline tests too.

For separately authorized live work only, install the optional SDK dependencies here with `npm ci --ignore-scripts`, set the provider key locally via the environment, review exact model access/pricing, and obtain approval for the concrete request. This is not enabled by restoring the Pi profile. Never paste keys in chat or commit them.

`--live --approve-paid` is a technical guard, not authorization for an agent to spend independently. Video also requires `--max-usd=N` covering the built-in estimate; that estimate is not a provider-enforced billing cap. A timeout may still incur a charge: inspect the provider before retrying. Outputs and request details in `runs/` stay private and ignored. Uploading a keyframe is external disclosure requiring the applicable approval.

`task.mjs TASK_ID` retrieves an existing Runway task using local authentication; it does not generate another video. It does not automatically download or publish results. Generated appearance, complete clip playback, rights and brand fidelity require separate review under the evidence-led design framework.
