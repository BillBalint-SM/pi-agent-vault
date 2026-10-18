---
name: evidence-led-design
description: Evidence-led UI/UX and visual-content design. Use for websites, interfaces, landing pages, social creative, image/video briefs, usability critiques and evaluating design quality. Requires explicit sources, proportional verification and honest impact claims; preserves the project's own design system.
---

# Evidence-led design

Before substantive design work, read `../../knowledge/ui-ux/FRAMEWORK.md`, resolved relative to this skill directory. For external claims or research, inspect `sources.json` in that directory and read the actual relevant source section; a registry entry is not proof that the whole source was reviewed. Use `review-template.json` for significant deliveries, not every minor edit.

## Mandatory behavior

1. Identify the user, task, medium, intended outcome, constraints and current source of truth. Mark unknowns; do not invent personas, research or metrics. Ask only blocking questions, otherwise declare reversible assumptions.
2. Inspect existing implementation and design rules before creating an alternative. For BontaFlow, read its canonical DESIGN.md and relevant format/course rules. Do not rebrand from a generic skill aesthetic.
3. Separate standards, heuristics, implementation examples, visual references and user evidence. Freshness and authority are different. Research current references for time-sensitive claims; do not sell a trend as a usability result.
4. Form a testable design hypothesis. For substantive visual exploration provide meaningfully distinct alternatives when useful, not arbitrary variants. Recommendation is not owner acceptance.
5. Review the result in a separate critical pass. Explicitly identify the strongest objection, failure cases and unresolved uncertainty. Self-review is not an independent reviewer or user test.
6. Verify actual rendered states for the affected format. Source inspection, screenshots, interactions, user studies and business measurements support different claims. Log evidence paths, conditions and limitations.
7. Never mark inaccessible interaction, clipped essential content, false claims, unlicensed assets or a broken primary task as acceptable because an aggregate design score is high.
8. Report what changed, what was checked, what remains untested and the next discriminating test. Do not guarantee usability, conversion or engagement.
9. No publication, paid generation, analytics deployment or external asset upload without the applicable user authorization. Do not fabricate testimonials, client results or likeness permissions.

For substantial deliveries, run `node <vault-root>/tools/check-design-review.mjs path/to/review.json` (the vault root is two directories above this skill). This checks report structure and obvious evidence mismatches only; it does not judge visual quality or certify accessibility. Read `FRAMEWORK.md` for details.
