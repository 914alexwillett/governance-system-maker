# PLANS.md

## Project name

Governance Capital Operating System

## Product thesis

Build a governance-controlled capital operating system where treasury assets are:
- held in custody
- classified by intent
- committed through explicit policy paths
- executed either as operating spend or payout distributions

## MVP goal

Create a demonstrable MVP that shows:

1. GovernanceToken exists and can anchor governance
2. Treasury can hold capital and track classifications
3. Treasury can allocate operating capital into dynamic buckets
4. Treasury can spend from budget buckets
5. Treasury can fund a Distributor for explicit payout events
6. Distributor can create funded events and process claims
7. Governor + Timelock can control Treasury / Distributor actions
8. Deployment and initialization can be run through an off-chain script

## Core modules

### GovernanceToken
- ERC20Votes-style governance token
- governance-controlled mint/burn hooks
- designed for future extensibility

### GovernanceGovernor
- proposal and voting logic
- token-weighted governance
- timelock-integrated execution

### GovernanceTimelock
- delayed execution layer
- owner of governed modules after handoff

### Treasury
- ETH and ERC20 custody
- capital classification
- dynamic operating budget buckets
- bucket spending
- distributor funding path

### Distributor
- funded discrete payout events
- claim accounting
- event-based claims
- future-compatible with richer historical entitlement logic

### Deployment pipeline
- deploy modules
- initialize parameters
- transfer ownership to timelock
- output addresses / config for later use

## Capital flow model

1. Unallocated custody
2. Policy classification
   - operating funds
   - distributable funds
3. Allocation path
   - budget allocation
   - distribution authorization
4. Execution
   - treasury spending
   - distributor payouts

## MVP constraints

Do not prioritize yet:
- advanced automation
- complex tokenomics
- upgradeable proxies
- deep front-end productization
- complex permission systems beyond what MVP needs
- advanced distribution scaling features beyond MVP needs

## Engineering priorities

### Priority 1
Stabilize repository structure, contracts, deployment flow, and tests.

### Priority 2
Keep the architecture modular enough to grow later.

### Priority 3
Make the product demonstrable locally or on testnet.

## Workflow model

Use:
- ChatGPT for architecture, planning, repo workflow, review, and ticket design
- Codex for scoped implementation tasks
- one scoped task at a time
- one worktree / branch per task
- review diffs before merge

## First milestone

Milestone 1: MVP repository foundation
- clean repo scaffold
- clear module boundaries
- basic README
- commands documented
- placeholder structure for contracts, scripts, and tests

## Second milestone

Milestone 2: Contract core
- token
- treasury
- distributor
- governance wiring

## Third milestone

Milestone 3: Deployable demo system
- deployment/init scripts
- basic scenario tests
- demo seed flow

## Fourth milestone

Milestone 4: Cleanup and hardening
- better tests
- deployment polish
- module cleanup
- documentation