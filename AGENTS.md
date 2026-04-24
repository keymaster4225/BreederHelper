# AGENTS.md

This file is the agent-facing working context for BreedWise. Use it with `CLAUDE.md`, but prefer this file when you need concise implementation guidance and project-specific guardrails.

## Project Overview

BreedWise is an offline-first Expo + React Native + TypeScript mobile app for horse breeding recordkeeping on a single device.

- Core storage: SQLite via `expo-sqlite`
- Primary product spec: `mare-tracker-spec.md`
- Default branch: `main`
- Remote: `origin` -> `https://github.com/keymaster4225/BreederHelper`

## User + Collaboration Expectations

- Do not just blindly agree with me. Push back, challenge my ideas.
- Explain reasoning clearly. 
- Never push to GitHub without explicit user permission.
- For multi-step work, continue autonomously when the path is clear and tests are passing.

## Current Product State

Implemented and actively used:

- Mares: create, edit, list, detail
- Stallions: create, edit, list
- Daily logs: create, edit, delete
- Daily log wizard: multi-step create/edit flow with ovary and uterus details
- Breeding records: create, edit, delete
- Pregnancy checks: create, edit, delete
- Foaling records: create, edit, delete
- Foal records: create, edit, delete, linked 1:1 to foaling records
- Frozen semen batches: create, edit, delete, with stallion-level frozen inventory tab
- Mare detail tabs: Daily Logs, Breeding, Pregnancy, Foaling, Meds
- Mare calendar screen with event dots and day-level history
- Home dashboard with actionable breeding alerts
- Onboarding flow plus persistent onboarding state
- Dev/sample data seeding for local testing and preview builds
- SQLite migrations, repository layer, Vitest, Jest screen tests, and linting

## Task Reference Files

Read these only when relevant to the current task:

- `docs/agent/architecture.md` for key paths, import boundaries, and code ownership conventions.
- `docs/agent/domain-and-ux-decisions.md` for data invariants, date rules, and preserved product/UX decisions.
- `docs/agent/dashboard-and-onboarding.md` for dashboard alert behavior and first-run rules.
- `docs/agent/seeding-preview-release.md` for sample data, preview builds, and release process notes.
- `docs/agent/commands-and-quality.md` for local commands, CI gates, and testing expectations.

Additional source references:

- `CLAUDE.md` for the longer project context snapshot.
- `README.md` for current repo layout and command summary.
- `mare-tracker-spec.md` for product behavior and data model intent.
- `docs/plans/` for recent design and implementation decisions.
