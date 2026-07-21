## Summary

- What changed and why (focus on the why; 1-3 bullets).
- Note anything reviewers should look at first.

## Linked issue

Closes #

(Use `Part of #N` for a slice of a larger issue that is not yet fully resolved.)

## Pre-flight checklist

- [ ] Pre-push gate green locally (`make gate`), or run via `/prep-pr`, which invokes it.
- [ ] Code review pass complete; critical and important findings fixed before pushing.
- [ ] Commits squashed before the first push.
- [ ] Labels set on `gh pr create --label ...`.
- [ ] No user-visible behavior change, so no docs or screenshot update is required.
      If that is not true, use the default PR template instead.

## Test plan

- [ ] `make gate` passes locally.
- [ ] `actionlint` clean, if any workflow changed.
- [ ] `node --test 'tests/js/*.test.mjs'` passes, if any JS changed (not yet in
      `make gate` or CI, see #177).
- [ ] Reviewer follow-ups (anything you want a second pair of eyes on):
  - [ ]
