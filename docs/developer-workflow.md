# Developer Workflow

This repository is optimized for small, scoped Codex tasks rather than broad refactors.

## Before You Change Code

Read, in order:
- `AGENTS.md`
- `PLANS.md`
- `README.md`

Then confirm:
- which module owns the task
- which files are in scope
- which verification command is expected

## Working Style

Prefer:
- one scoped task at a time
- one branch or worktree per task
- minimal diffs
- explicit verification
- small follow-up notes instead of speculative rewrites

Avoid:
- changing adjacent modules without a clear correctness reason
- broad cleanup mixed into behavior changes
- introducing new infrastructure unless the task really needs it

## Module Boundaries

Use the domain folders under `contracts/` as the main source of truth:
- `contracts/governance/`
- `contracts/treasury/`
- `contracts/distributor/`
- `contracts/shared/`

`contracts/interfaces/` currently exists as a shared compatibility surface. Prefer not to expand it casually unless the task clearly needs a cross-module interface.

## Local Workflow

Common commands:

```bash
npm run compile
npm run test:node:prod
npm run deploy:local
npm run seed:demo
```

What they are for:
- `compile`
  - quick compile check during implementation
- `test:node:prod`
  - run the targeted Node suite against the production build profile
- `deploy:local`
  - deploy the current MVP stack to the local Hardhat mainnet simulation
- `seed:demo`
  - create a readable demo state for local walkthroughs

## Testing Notes

The active Node test suite lives in:
- `test/nodejs/`
- `test/nodejs/helpers/`

The suite is intentionally compact:
- treasury behavior
- distributor happy path
- governance handoff and execution
- one end-to-end scenario

Prefer adding focused tests that reflect actual ownership and governance flow instead of building a large helper framework.

## Demo Notes

The local demo seed flow is governance-aware.

That means:
- treasury and distributor actions happen after ownership handoff
- seeded state changes go through the governor and timelock path
- the local seeded distribution is intentionally left claimable for demos

## Cleanup That Can Wait

The repo still has a few MVP-era rough edges that are acceptable for now:
- some older placeholder README files under subfolders
- duplicate-looking interface locations between domain folders and `contracts/interfaces/`
- deployment and demo scripts that are explicit by design rather than heavily shared

Those are reasonable future cleanup tasks, but they should stay separate from contract behavior changes.
