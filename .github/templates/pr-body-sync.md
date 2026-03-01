## 🍓 Summary
- **What changed:** Opened automated sync PR from `master` to `develop` after a merged release branch.
- **Why it matters:** Keeps `develop` aligned with the latest released baseline without bypassing branch protection.

## ⭐ Validation
- **Commands/Tests run:** Workflow-driven sync branch creation and PR automation.
- **Result:** Sync PR generated from release context.
- **Release version:** `$SYNC_VERSION`
- **Source release branch:** `$SYNC_SOURCE_BRANCH`
- **Source merge SHA:** `$SYNC_SOURCE_SHA`
- [x] *If not applicable, explain why (e.g., `Validation: not needed`)*

## 📦 Checklist
- [x] This PR is automation-generated for branch alignment only.
- [x] No runtime code path changes were introduced intentionally.
- [x] This PR still requires normal checks/review before merge.
