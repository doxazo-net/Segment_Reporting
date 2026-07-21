## Summary

- What changed and why (focus on the why; 1-3 bullets).
- Note any user-visible behavior change.
- Call out anything reviewers should look at first.

## Linked issue

Closes #

(Use `Part of #N` for a slice of a larger issue that is not yet fully resolved.
GitHub binds the keyword to the ONE number after it, so repeat it for each:
`Closes #1, closes #2`.)

## Pre-flight checklist

- [ ] Pre-push gate green locally (`make gate`), or run via `/prep-pr`, which invokes it.
- [ ] Code review pass complete; critical and important findings fixed before pushing.
- [ ] Commits squashed before the first push (reviewers read the full changeset at once).
- [ ] Labels set on `gh pr create --label ...`.
- [ ] Screenshot attached for any UI change, and `docs/Screenshots/` refreshed if an
      existing screenshot no longer matches. Screenshots must not contain real
      media library names.
- [ ] Docs updated in the same commit for any documented behavior change:
      `README.md` (features, install), `docs/USER_GUIDE.md` (admin workflows,
      labels, settings), `docs/DEVELOPER.md` (API, schema, build, CI). See the
      table in `CLAUDE.md`.
- [ ] Version bumped in `Properties/AssemblyInfo.cs` if this ships a release.

## Test plan

- [ ] `make gate` passes locally: Release build with analyzers as errors,
      `dotnet test`, `dotnet format --verify-no-changes`, eslint, html-validate.
- [ ] `node --test 'tests/js/*.test.mjs'` passes, if any JS under `scripts/` or
      `tests/js/` changed. Note: this suite is not yet wired into `make gate` or
      CI (see #177), so it must be run by hand.
- [ ] 4.9 ABI still compiles if the plugin source changed
      (`dotnet build segment_reporting/segment_reporting.csproj -c Release -p:EmbyAbi=4.9`).
      CI enforces this, but catching it locally is cheaper.
- [ ] UAT performed against a real Emby server for user-visible changes
      (`make uat`, or `make uat-deploy` plus manual steps). Run the plugin, not
      just the test suite.
- [ ] Manual UAT steps (list the specific flows exercised):
  - [ ]
  - [ ]
- [ ] Reviewer follow-ups (anything you want a second pair of eyes on):
  - [ ]
