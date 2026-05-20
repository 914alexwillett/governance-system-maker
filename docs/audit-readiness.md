# Audit Readiness

This document is a first-pass reviewer guide for the governance capital MVP.

It is not a formal audit report. It is meant to answer the early questions a technically literate reviewer is likely to ask:
- what the system does
- what the major trust and permission boundaries are
- what accounting invariants matter most
- what the tests currently cover
- what is intentionally out of scope for this MVP

## Scope Of The Current MVP

Implemented on-chain modules:
- `GovernanceToken`
- `GovernanceGovernor`
- `GovernanceTimelock`
- `Treasury`
- `Distributor`

Implemented off-chain workflow:
- deployment and initialization through [scripts/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/deploy-v3.ts)
- local demo seeding through [scripts/seed-v3-demo.ts](/C:/Users/914al/governance-system-maker/scripts/seed-v3-demo.ts)
- targeted Node tests under [test/nodejs](/C:/Users/914al/governance-system-maker/test/nodejs)

Out of scope for this document:
- frontend UX concerns beyond how they reflect the real control model
- a claim that the system has already received a full independent security review

## System Model

Plain-language capital flow:
1. Capital enters custody.
2. Treasury classifies that capital by purpose.
3. Operating capital can be committed into budget buckets.
4. Bucketed capital can be spent.
5. Distributor events can be created and funded.
6. Claims reduce funded outstanding liabilities.
7. Sensitive module actions are intended to move through governor plus timelock after handoff.

Plain-language governance flow:
1. A token holder with enough delegated voting power creates a proposal.
2. Voting uses token checkpoints from the governance token.
3. A successful proposal is queued in the timelock.
4. The timelock delay must pass before execution.
5. Executed calls reach governed modules through the timelock ownership boundary.

## Ownership And Trust Assumptions

Intended steady-state ownership:
- `GovernanceToken` owner: timelock
- `Treasury` owner: timelock
- `Distributor` owner: timelock
- timelock proposer: governor
- timelock executor: governor
- timelock admin: timelock itself after bootstrap sealing

Bootstrap assumption:
- deployment starts with one deployer account holding temporary admin and owner roles
- the deploy script is trusted to complete the handoff sequence correctly

Operational trust assumptions in the current MVP:
- the bootstrap deployer behaves honestly during initialization
- the configured RPC and deployment environment are honest enough to deploy and read state
- standard ETH and ordinary ERC20 transfer behavior are assumed where token transfers are used
- the off-chain scripts and UI are convenience layers, not authorization boundaries

## High-Priority Invariants

Treasury invariants:
- classified balances for an asset must not exceed actual custody for that asset
- unallocated balance is derived from actual custody minus total classified balance
- operating capital already committed to buckets must not be declassified away
- bucket spending must not exceed remaining bucket allocation

Distributor invariants:
- funded amount for a distribution must not exceed the configured total amount
- claim amounts must not exceed the funded but unclaimed amount
- total outstanding liability for an asset must track funded minus claimed amounts
- each recipient may claim at most once per distribution in the current implementation

Governance invariants:
- token voting uses checkpoints rather than current balance only
- proposals follow a state machine: pending, active, succeeded or defeated, queued, executed or canceled
- queueing and execution should only happen through the timelock path after handoff

## Sensitive Behaviors By Module

`GovernanceToken`
- owner-controlled mint and burn
- delegation and checkpoint writes on balance movement
- historical vote lookups used by the governor

`GovernanceGovernor`
- proposal threshold enforcement
- quorum calculation from historical token supply
- single-action proposal model in this MVP
- queue and execute routing into the timelock

`GovernanceTimelock`
- role updates for admin, proposer, and executor
- operation scheduling, cancellation, and execution
- delay enforcement before execution

`Treasury`
- classification and reclassification of capital
- allocation and deallocation of operating budget buckets
- direct value transfer on bucket spend

`Distributor`
- distribution creation and funding
- self-claim enforcement
- outstanding liability accounting and distribution closure

## What Is Implemented Now

Implemented now:
- governance token checkpoints and delegation
- governor proposal and vote lifecycle
- timelock delayed execution
- treasury ETH and ERC20 custody accounting
- capital classification and operating bucket mechanics
- distributor funded event creation and self-claim flow
- deployment, handoff, seed, and targeted tests

Intentionally postponed:
- upgradeability
- broader role systems beyond owner plus governor plus timelock
- richer distribution entitlement enforcement on-chain
- multi-call governance proposals
- a direct treasury-to-distributor funding pathway with separate capital accounting treatment
- comprehensive monitoring or admin tooling

## Known MVP Limitations

Distribution limitation:
- the current `Distributor` uses a simple self-claim path
- proof-style claim tooling exists off-chain for demo and future-compatibility purposes, but Merkle proofs are not enforced on-chain yet

Governance limitation:
- the current governor is intentionally narrow and single-action
- broader governance ergonomics and richer lifecycle tooling would need further review if expanded

Deployment limitation:
- deployment remains an off-chain script-based flow
- the frontend launcher is a preparation and review layer, not a privileged deployment backend

Review depth limitation:
- this repository includes targeted tests, not exhaustive property testing or fuzzing
- this documentation should not be read as evidence of completed external audit work

## Current Test Coverage

Covered today in [test/nodejs](/C:/Users/914al/governance-system-maker/test/nodejs):
- treasury classification, allocation, spending, and invariant-sensitive declassification paths
- distributor happy path plus staged funding and self-claim edge cases
- governance ownership handoff and timelock execution path
- one end-to-end scenario tying treasury, distributor, and governance together

Not yet covered at high depth:
- broad ERC20-path testing
- extensive revert-matrix coverage for every branch
- adversarial or economic analysis beyond the implemented checks
- gas-focused review and bytecode growth management beyond basic MVP decisions

## Questions This Doc Helps Answer

- Which module is supposed to control which behavior?
- Where does authority sit before and after handoff?
- What balances and liabilities must stay internally consistent?
- Which simplifications are deliberate MVP choices rather than accidental omissions?
- Where should a deeper external review spend time later?

## What A Fuller External-Audit Prep Package Would Need Later

- a frozen scope and commit hash for review
- explicit threat model and trust-boundary diagrams
- per-function privilege tables
- line-by-line invariant mapping to tests
- broader negative-path and fuzz coverage
- deployment environment assumptions and operational runbooks
