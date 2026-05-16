# Governance Capital Operating System

A governance-controlled capital operating system MVP.

The current repo demonstrates a simple but coherent capital flow:
- treasury assets are held in custody
- capital is classified by intent
- operating capital can be bucketed and spent
- distribution events can be created and funded
- governance decisions execute through a governor and timelock handoff

## What The MVP Includes

### On-chain modules

- `GovernanceToken`
  - ERC20-style governance token with vote delegation and checkpoints
- `GovernanceGovernor`
  - token-weighted proposal, voting, queue, and execute flow
- `GovernanceTimelock`
  - delayed execution owner for governed modules
- `Treasury`
  - ETH/ERC20 custody, capital classification, operating buckets, and bucket spend flow
- `Distributor`
  - funded event-based distributions with self-claim accounting

### Off-chain workflow

- `scripts/deploy-v3.ts`
  - canonical deployment and ownership handoff flow
- `scripts/seed-v3-demo.ts`
  - local demo seed flow that leaves the system in a useful example state
- `frontend/`
  - minimal read-only local dashboard for demo visibility
- `test/nodejs/*`
  - focused Node tests for module behavior and one end-to-end scenario

## Product Story

The intended MVP story is:

1. Governance deploys the token, treasury, distributor, timelock, and governor.
2. Ownership of treasury-facing modules moves to the timelock.
3. Token holders use the governor to approve treasury and distributor actions.
4. Treasury capital is classified, allocated, spent, or used to support distributions.
5. Distributor events are funded and left available for recipient claims.

## Quick Start

```bash
npm install
npm run compile
npm run test:node:prod
```

For a local demo run:

```bash
npm run deploy:local
npm run seed:demo
```

For the local dashboard demo:

```bash
npm run chain:dev
npm run seed:demo:ui
npm run ui:dev
```

## Commands

```bash
npm install
npm run clean
npm run compile
npm run compile:prod
npm run build
npm test
npm run node-test
npm run test:node
npm run test:node:prod
npm run deploy:local
npm run seed:demo
npm run seed:demo:ui
npm run ui:dev
```

Command notes:
- `npm run compile`
  - default Hardhat compile
- `npm run compile:prod`
  - compile with the production optimizer profile
- `npm run node-test`
  - run the Node test suite from `test/nodejs`
- `npm run test:node:prod`
  - run the Node suite against the production build profile
- `npm run deploy:local`
  - deploy the full MVP stack to the local `hardhatMainnet` simulation
- `npm run seed:demo`
  - create a local seeded demo state after deployment-style setup
- `npm run seed:demo:ui`
  - seed the current MVP onto a persistent local JSON-RPC chain for the demo dashboard
- `npm run ui:dev`
  - serve the minimal local dashboard at `http://127.0.0.1:4173`

## Local Demo Flow

The local demo script creates a readable example state:

1. deploy or load the current MVP modules
2. fund the treasury with ETH
3. fund the timelock for governed distributor funding
4. classify operating capital through governance
5. allocate one operating budget bucket
6. spend part of that bucket
7. create and fund one community distribution event
8. leave that distribution unclaimed so there is still a next action to demo

Important local note:
- `hardhatMainnet` is an ephemeral local simulation
- `scripts/seed-v3-demo.ts` deploys a fresh local stack when no reusable addresses are configured
- on a persistent network, the seed script can load addresses from environment variables instead

## Demo Dashboard

The repo now includes a minimal local dashboard under `frontend/`.

What it does today:
- displays deployed contract addresses
- reads treasury balances and classifications
- reads tracked budget bucket state
- reads tracked distributor event state
- reads timelock ownership wiring

What it intentionally does not do yet:
- wallet connection
- write actions
- broad on-chain enumeration of buckets or distributions

The current MVP contracts do not enumerate bucket ids or distribution ids on-chain, so the dashboard reads the tracked ids you configure in the UI. The built-in defaults match a fresh local run of `npm run seed:demo:ui` against a new `hardhat node`.

To run the dashboard locally:

1. In one terminal, start the local chain:

```bash
npm run chain:dev
```

2. In a second terminal, seed the demo state onto that chain:

```bash
npm run seed:demo:ui
```

3. In a third terminal, start the dashboard:

```bash
npm run ui:dev
```

4. Open:

```text
http://127.0.0.1:4173
```

## Repository Map

```text
contracts/
  governance/
  treasury/
  distributor/
  shared/
  interfaces/

scripts/
  config/
  deploy-v3.ts
  seed-v3-demo.ts

test/
  nodejs/
    helpers/

docs/
  README.md
  developer-workflow.md

frontend/
  index.html
  app.js
  rpc.js
  demo-config.js
  server.mjs
  styles.css
```

Navigation notes:
- prefer the domain folders under `contracts/` when working on module behavior
- `contracts/interfaces/` currently holds shared compatibility interfaces used across modules
- the active Node test runner points at `test/nodejs`

## Codex Workflow

This repo is set up for scoped Codex tasks.

Before changing code:
- read `AGENTS.md`
- read `PLANS.md`
- read this `README.md`

Working style expectations:
- keep tasks narrow and reviewable
- preserve module boundaries
- avoid speculative rewrites
- verify compile and the scoped test command before calling a task done

The most useful repo guidance lives in:
- [AGENTS.md](/C:/Users/914al/governance-system-maker/AGENTS.md)
- [PLANS.md](/C:/Users/914al/governance-system-maker/PLANS.md)
- [docs/developer-workflow.md](/C:/Users/914al/governance-system-maker/docs/developer-workflow.md)

## Docs

- [docs/README.md](/C:/Users/914al/governance-system-maker/docs/README.md)
- [docs/developer-workflow.md](/C:/Users/914al/governance-system-maker/docs/developer-workflow.md)

## Current Limits

This is still an MVP. It intentionally does not prioritize:
- advanced deployment orchestration
- complex permissions beyond the current owner/governor/timelock model
- richer distribution entitlement logic
- polished front-end productization
- broader cleanup of older placeholder files unless they improve near-term clarity
