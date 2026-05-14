# Governance Capital Operating System

A governance-controlled capital operating system MVP.

This project explores a system where treasury assets are:
- custodied
- classified
- budgeted
- spent or distributed through explicit governance-controlled policy flows

## MVP modules

- GovernanceToken
- GovernanceGovernor
- GovernanceTimelock
- Treasury
- Distributor
- off-chain deployment / initialization pipeline

## Intended product shape

The MVP should demonstrate:

- treasury custody of capital
- classification between operating and distributable funds
- dynamic operating budget buckets
- bucket-based spending
- discrete funded distribution events
- governance-controlled execution through Governor + Timelock
- repeatable deployment and initialization flow

## Repo workflow

This repository is designed for a Codex-first implementation workflow.

- architecture and task design are handled in ChatGPT
- implementation work is done through scoped Codex tasks
- each task should stay narrow and reviewable
- each task should ideally live on its own branch or worktree

Read these files before making changes:
- `AGENTS.md`
- `PLANS.md`

## Suggested repo structure

```text
contracts/
  governance/
  treasury/
  distributor/
  shared/

scripts/
  deploy/
  init/
  config/

test/
  node/
  helpers/

docs/
```

## Commands

```bash
npm install
npm run compile
npm run build
npm test
npm run node-test
npx hardhat run scripts/deploy-v3.ts --build-profile production --network hardhatMainnet
```

## Scaffold Notes

- `contracts/governance/` is reserved for `GovernanceToken`, `GovernanceGovernor`, and `GovernanceTimelock`
- `contracts/treasury/` is reserved for treasury custody, classification, allocation, and spend logic
- `contracts/distributor/` is reserved for funded payout event and claim logic
- `contracts/shared/` is reserved for small shared interfaces or libraries if the MVP needs them
- `scripts/deploy/`, `scripts/init/`, and `scripts/config/` keep deployment concerns separated
- `test/node/` keeps node-based scenario coverage aligned with the on-chain module boundaries
