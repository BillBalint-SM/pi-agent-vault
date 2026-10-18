# Pi – evidence-led design framework

## Purpose and boundaries

Improve how this agent designs and evaluates UI/UX and visual content. This is a persistent working procedure and a curated knowledge entry point, not model retraining or an expert certification. A polished presentation and passing code tests are not proof of user benefit.

Owner: Pi-only workspace. Created from the user's request for accountable design practice. The framework governs the agent's process, never replaces a project's canonical brand/business rules. No background updating is implied.

## 1. Source hierarchy

- Applicable law, normative standards and project requirements: identify scope and exact criteria; do not infer legal compliance from a checklist.
- Current owner-approved project identity, content and component contracts: control brand and implementation decisions, subject to applicable requirements.
- Direct user research and observed task evidence: support claims about those participants, tasks and conditions, not every user.
- Research syntheses and established heuristics: guide hypotheses and expert inspection; they do not prove this implementation works.
- Platform/design-system documentation: implementation and platform guidance, not universally transferable visual styles.
- Visual showcases and trends: inspiration and quality references only. Public access is not a reuse licence, and an award is not conversion evidence.
- Model recollection and agent taste: suggestions to test, not citable evidence.

Track disagreement and context instead of arbitrarily averaging sources. A recent article is not automatically stronger than a well-established standard.

## 2. Research and maintenance

`sources.json` is the verified entry-point register. It records precisely what was inspected. Fetch the actual relevant sections before applying numeric or behavioral requirements; homepage or table-of-contents inspection is not a full review.

Suggested local review cadence, not an automated service: normative/platform guidance every 90 days and before version-sensitive changes; heuristics every 180 days; visual/channel references within 30 days of a trend-sensitive assignment; model availability/pricing at the time of a proposed paid job. These intervals are workflow policy, not scientifically established expiry dates.

For a trend-sensitive project, inspect at least three relevant examples with dates and record: audience/task, composition, typography, motion, likely benefit, risk, accessibility/performance cost, reuse rights and BontaFlow fit. State the limited sample; never infer market prevalence from a few examples. No current trend study has yet been completed by this framework.

Summarize and link sources instead of copying copyrighted articles or proprietary kits. No paywall bypass. Record failed access and do not silently substitute remembered text. Source updates occur during authorized sessions, not autonomously in the background.

## 3. Proportional workflow

### Understand

Record user/audience, real task, medium, primary action, business objective, constraints, baseline, source-of-truth paths and evidence gaps. Unknown target behavior remains a hypothesis. Reuse known owner decisions; do not repeatedly ask settled preferences.

### Frame

Use: 'For [audience], [change] may help [task/outcome] because [reason/source]; we will assess it with [test/metric], while guarding against [risk].' A testable hypothesis is not a promised uplift.

### Design

Reuse existing components, tokens and format masters. Explore alternatives when there is a meaningful choice. Explain trade-offs in hierarchy, density, expressiveness, effort and accessibility. Avoid irrelevant animation, generic stock symbolism and false urgency. Keep wording concrete and preserve qualifications. Do not compress informative text until it becomes unreadable.

### Critique

Use a separate pass after implementation: What is the strongest reason this could fail? What may a first-time user misunderstand? Is decoration competing with the action? Are there broken or misleading states? What would disconfirm the recommendation? State explicitly that this is same-agent self-review.

### Verify

Test the affected artifact, not only the code. Keep known blockers visible. Small text changes can use a short checklist; shared visual/interaction changes need affected-consumer review and relevant responsive states. No new heavy framework or audit of the entire project merely for a minor correction.

### Deliver and learn from results

Separate created, technically checked, visually reviewed, user-tested, owner-approved and published. Record recurring defects and accepted corrections in `lessons.md` with context. Promote a lesson to a general rule only when its evidence and scope justify it. Never infer approval from silence or from a default option.

## 4. Format-specific verification

### Web / applications

- Primary task and navigation: operate the actual interactions, including failure/recovery where relevant. Check empty/loading/error/success, disabled/busy, focus return and interrupted motion as applicable.
- Inspect representative narrow/medium/wide layouts and both sides of affected breakpoints. For BontaFlow, follow its canonical viewport/zoom contracts; do not invent a new universal set.
- Keyboard operation, accessible names/roles, reading order, contrast on actual surfaces, reflow/enlargement, visible and unobscured focus, reduced-motion/static alternatives. Use native elements when sufficient.
- Automated accessibility checks are partial. Assistive-technology and physical-device trials are separate evidence; desktop emulation is not a phone test.
- Performance: compare repeatable lab runs to a baseline; field Core Web Vitals require real-user data. Lab speed is not observed conversion impact.

### Social / images / thumbnails

Check the native export, phone-sized readability, exact original logo, Hungarian accents, actual font loading, safe areas and intended crops. Read the content hierarchy without enlarging the thumbnail. Image generation is not typography production. Inspect anatomy/geometry, inconsistent shadows, hallucinated labels and unintended symbolism.

### Video / motion

Watch the complete exported clip at normal speed with and without sound; a still frame or metadata probe is not playback review. Check readable hold times, scene continuity, temporal artifacts, captions/spelling, safe areas, ending/CTA, audio rights and clipping. Check the site's static/reduced-motion alternative if embedding. Flashing, distracting motion and misleading synthetic people/results are risks, not quality signals.

## 5. Evidence classes and allowed claims

| Evidence kind | Supports | Does not establish |
|---|---|---|
| source | Documented implementation or rule agreement | Rendered appearance or usability |
| technical | The specific measured code/export property | Visual excellence or engagement |
| rendered | Appearance in recorded states/viewports | Actual interaction success or comprehension |
| interaction | Tested actions and responses in recorded conditions | Real audience understanding or conversion |
| user-study | Observations from specified participants/tasks | Universal usability or reliable commercial uplift |
| field | The recorded real-world metric and context | Causal improvement without a suitable design |
| experiment | The tested comparison under stated methodology | Generalization beyond its design/population |

A screenshot, synthetic persona, click simulation or the agent's opinion is not a user study. Qualitative small-sample studies can reveal problems but do not establish population conversion rates. A/B results need a defined outcome/denominator, randomization, duration/sample plan, uncertainty and guardrails; do not stop opportunistically when a result looks positive. Never invent traffic or install trackers without authorization.

## 6. Acceptance and blockers

Assess hierarchy, clarity, identity, composition, responsive/crop behavior, interaction, accessibility, motion, content truth, rights and performance separately. Avoid an unexplained total 'UX score'. Statuses: pass, fail, not-tested, not-applicable. Every pass needs applicable evidence. Missing evidence is not a pass.

Block delivery as production-ready if the primary task is broken, essential content is clipped, required input is inaccessible, claims are fabricated, or necessary rights are absent. An inaccessible prototype may be shown as an explicitly labelled exploration, never as a ready production asset.

A review validator checks record consistency only. It cannot detect all false evidence, judge aesthetic quality or certify WCAG conformance. Human judgment and appropriate research remain necessary.

## 7. BontaFlow binding

Canonical design: the owning BontaFlow project's `DESIGN.md`. Resolve its actual checkout from the current task or machine-local project map; do not invent a path or copy that specification into this vault.
Entry point: `design-system/bontaflow/MASTER.md`; format geometry/export: `design-system/bontaflow/templates/README.md`; common tokens: `src/styles/prism.css`.
For publishable copy consult the project's Hungarian writing guide, claims matrix and proof register. Course-specific exceptions remain bounded. Preserve production logo geometry and separate it from generated imagery.

Pi-created helpers remain under the user's Pi-only workspace (`~/pi/` or its explicitly configured equivalent). Brand rules remain in their owning repository. The content project's adapter unit tests do not establish that its briefs produce attractive visuals.
