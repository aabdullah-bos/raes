# raes-execute — prd-ux-review.md

## Purpose

This review captures operator experience ambiguity and risk for `raes-execute` based on `RAES Execute`.

## Observed Requirements

- The PRD should remain the source of truth for operator-facing behavior.

## UX Risks

- Operators need a clear failure message when configuration is invalid or missing.
- Exit codes must be documented and consistent across all failure modes.
- Partial state mutations must be detectable — the operator must know whether to retry or recover.

## Open Questions

- Should the tool support a dry-run mode before performing side effects?
- What is the expected output format for success and failure (structured JSON vs human-readable)?
- How should the operator be informed when the tool is waiting on a slow external call?
