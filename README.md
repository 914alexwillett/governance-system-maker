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

scripts/
  config/

test/
  nodejs/
    helpers/

docs/