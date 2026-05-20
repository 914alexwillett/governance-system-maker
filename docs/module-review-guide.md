# Module Review Guide

This note is a compact map for someone reviewing the current contract set.

It focuses on module boundaries, public responsibilities, and the questions that deserve the most attention during a deeper review.

## GovernanceToken

Primary file:
- [GovernanceToken.sol](/C:/Users/914al/governance-system-maker/contracts/governance/GovernanceToken.sol)

Purpose:
- ERC20-style governance token
- delegation and vote checkpoints
- owner-controlled mint and burn hooks

Boundary:
- token does not implement proposal logic
- token provides historical voting power to the governor

Reviewer focus:
- checkpoint correctness on mint, burn, transfer, and delegate changes
- owner privilege scope
- historical lookup behavior

## GovernanceGovernor

Primary file:
- [GovernanceGovernor.sol](/C:/Users/914al/governance-system-maker/contracts/governance/GovernanceGovernor.sol)

Purpose:
- proposal creation
- vote casting
- quorum and proposal-threshold checks
- queue and execute through timelock

Boundary:
- current MVP supports one target, one value, one calldata payload per proposal
- execution authority is meant to flow through the timelock, not directly to governed modules

Reviewer focus:
- proposal lifecycle transitions
- snapshot and deadline handling
- quorum and threshold calculations
- queue and execute path into the timelock

## GovernanceTimelock

Primary file:
- [GovernanceTimelock.sol](/C:/Users/914al/governance-system-maker/contracts/governance/GovernanceTimelock.sol)

Purpose:
- delayed execution owner
- operation scheduling and execution
- bootstrap role updates

Boundary:
- this is the owner boundary for governed modules after handoff
- the timelock is not a generalized role manager beyond the current admin, proposer, and executor model

Reviewer focus:
- delay enforcement
- schedule and execute state transitions
- admin, proposer, and executor update safety
- behavior before and after bootstrap sealing

## Treasury

Primary file:
- [Treasury.sol](/C:/Users/914al/governance-system-maker/contracts/treasury/Treasury.sol)

Purpose:
- custody of native ETH and standard ERC20 balances
- capital classification
- operating bucket allocation and spending

Boundary:
- treasury is about custody and accounting
- governance decides policy indirectly through owner-restricted functions once the owner is the timelock
- the current MVP does not include broad treasury policy orchestration beyond these primitives

Reviewer focus:
- classified versus unallocated balance accounting
- operating bucket commitment and spend safety
- declassification and reclassification behavior when buckets are already committed
- external asset transfer behavior

## Distributor

Primary file:
- [Distributor.sol](/C:/Users/914al/governance-system-maker/contracts/distributor/Distributor.sol)

Purpose:
- creation of funded distribution events
- per-recipient claim accounting
- funded liability tracking

Boundary:
- current claims are self-claims
- proof tooling exists off-chain, but proof verification is not enforced on-chain in this MVP
- distributor funding and configuration are still owner-restricted and therefore meant to sit behind timelock ownership after handoff

Reviewer focus:
- funded amount versus configured total amount
- claimed amount versus funded amount
- outstanding liability accounting
- one-claim-per-recipient behavior and closure logic

## Cross-Module Questions

Questions a reviewer should trace across modules:
- Does the deployment flow actually land ownership in the intended steady-state configuration?
- Do treasury and distributor actions remain consistent with the governor plus timelock path after handoff?
- Are demo and script assumptions accidentally relied on as if they were on-chain guarantees?
- Do the tests exercise the same ownership path that the deployment script establishes?

## Supporting Files

Useful context when reviewing:
- [scripts/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/deploy-v3.ts)
- [scripts/seed-v3-demo.ts](/C:/Users/914al/governance-system-maker/scripts/seed-v3-demo.ts)
- [docs/audit-readiness.md](/C:/Users/914al/governance-system-maker/docs/audit-readiness.md)
- [test/nodejs/helpers/fixtures.ts](/C:/Users/914al/governance-system-maker/test/nodejs/helpers/fixtures.ts)
