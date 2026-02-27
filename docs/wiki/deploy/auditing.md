---
summary: "Documentation sanity gate reference for deploy and release workflows"
read_when:
  - You are validating wiki quality before release
  - You need to understand warning vs error behavior in doc sanity
  - You are enforcing documentation consistency gates
title: "auditing"
---

# `Auditing and sanity`

Berry wiki quality is validated by the doc sanity script.
This gate is part of release validation flow and should be run before shipping documentation changes.

## Main command

```bash
npm run wiki:claim
```
Result: Runs documentation sanity checks and reports warnings/errors.

## What the sanity gate checks

- Symbol/reference integrity against code exports.
- Link validity and case-sensitive path correctness.
- Claim/evidence consistency checks.
- Tone and density warnings for documentation quality.
- CLI contract checks for command-block formatting in markdown.

## Warning vs error behavior

- Warnings report quality issues but do not fail process exit by default.
- Errors trigger non-zero exit and fail the gate.

Operational implication:
- Release pipelines should treat errors as blocking.
- Teams may choose stricter policy for warnings at final review stage.

## Recommended workflow

1. Edit docs in focused scope.
2. Run sanity gate.
3. Fix blocking errors first.
4. Resolve tone and consistency warnings according to team policy.

## Related pages
- [deploy index](README.md)
- [build](build.md)
- [installation](installation.md)

---

## Navigation
- [Back to Deploy Index](README.md)
- [Back to Wiki Index](../README.md)

