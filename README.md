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
  - minimal local dashboard with a launch planner, wallet connection, and a couple of safe MVP actions
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

For a real testnet deployment:

```bash
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
```

For the local dashboard demo:

```bash
npm run chain:dev
npm run seed:demo:ui
npm run ui:dev
```

For the local launch-planner UX:

```bash
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
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
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
- `npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia`
  - deploy the full MVP stack to Ethereum Sepolia using explicit config variables
- `npm run seed:demo`
  - create a local seeded demo state after deployment-style setup
- `npm run seed:demo:ui`
  - seed the current MVP onto a persistent local JSON-RPC chain for the demo dashboard
- `npm run ui:dev`
  - serve the launch planner and demo dashboard at `http://127.0.0.1:4173`

## Local Demo Flow

The local demo script creates a readable example state:

1. deploy or load the current MVP modules
2. fund the treasury with ETH
3. fund the timelock for governed distributor funding
4. seed a second governance participant with self-delegated voting power
5. classify operating capital through governance
6. allocate one operating budget bucket
7. spend part of that bucket
8. create and fund one community distribution event
9. leave that distribution unclaimed so there is still a next action to demo

Important local note:
- `hardhatMainnet` is an ephemeral local simulation
- `scripts/seed-v3-demo.ts` deploys a fresh local stack when no reusable addresses are configured
- on a persistent network, the seed script can load addresses from environment variables instead

## Testnet Deployment

The repo now supports a structured Sepolia deployment path.

Required config variables:

```text
SEPOLIA_RPC_URL
SEPOLIA_PRIVATE_KEY
```

What each value is for:
- `SEPOLIA_RPC_URL`
  - your Ethereum Sepolia RPC endpoint
- `SEPOLIA_PRIVATE_KEY`
  - the bootstrap deployer private key used to deploy and perform the initial timelock handoff

PowerShell example:

```powershell
$env:SEPOLIA_RPC_URL="https://your-sepolia-rpc-url"
$env:SEPOLIA_PRIVATE_KEY="0xyourprivatekey"
```

Deploy command:

```bash
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
```

What the Sepolia deployment does:

1. deploy `GovernanceToken`
2. deploy `Treasury`
3. deploy `Distributor`
4. deploy `GovernanceTimelock`
5. deploy `GovernanceGovernor`
6. optionally self-delegate the initial governance token voting power to the bootstrap deployer
7. update timelock proposer and executor to the governor
8. transfer token, treasury, and distributor ownership to the timelock
9. transfer timelock admin to the timelock itself

What the deployment output includes:
- deployed contract addresses
- network name and chain id
- the final governance handoff state
- config values used for the deployment
- explorer links when the network config provides an explorer base URL

Current testnet assumptions:
- Sepolia uses a longer timelock delay than local development
- Sepolia uses a longer voting period than local development
- the current deployment flow is bootstrap-driven from one deployer account before timelock handoff
- contract verification is not wired into this MVP deploy script yet

## Demo Dashboard

The repo now includes a minimal local launch planner and dashboard under `frontend/`.

## Launch Planner

The first-pass deployer UX is intentionally honest about the current architecture.

What it does:
- collects a small launch profile such as network, token identity, initial supply, and timelock delay
- shows the exact module stack that the MVP deployment script will deploy
- shows the ownership and governance handoff sequence
- generates the real deploy command and config preview that map to `scripts/deploy-v3.ts`

What it does not do yet:
- deploy contracts directly from the browser
- replace the current off-chain Hardhat deployment model
- create an on-chain factory or one-click launch contract

Why this shape:
- the current MVP already has a clean script-based deployment flow
- this launch planner is a product-facing review and preparation layer on top of that flow
- it makes the system feel closer to a real “launch a governance capital system” experience without misrepresenting how deployment actually works today

To use it locally:

1. Start the UI server:

```bash
npm run ui:dev
```

2. Open:

```text
http://127.0.0.1:4173
```

3. Use the `Launch System` section to:
- choose a local or Sepolia launch profile
- set the small set of launch parameters exposed in the MVP planner
- review the deploy command, env requirements, config preview, and handoff steps

The planner maps directly to:
- [scripts/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/deploy-v3.ts)
- [scripts/config/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/config/deploy-v3.ts)
- [docs/deployer-flow.md](/C:/Users/914al/governance-system-maker/docs/deployer-flow.md)

What it does today:
- includes a guided demo walkthrough for first-time users
- displays deployed contract addresses
- reads treasury balances and classifications
- reads tracked budget bucket state
- reads tracked distributor event state
- reads governance proposals, vote totals, and proposal status
- shows a role and control view for ownership and governance relationships
- shows a compact system health view for funding, handoff posture, and basic readiness signals
- reads timelock ownership wiring
- shows a lightweight recent activity feed from treasury, distributor, and governor logs
- connects an injected wallet such as MetaMask
- funds treasury ETH custody directly from the connected wallet
- exposes a small treasury action form for bucket allocation and bucket spend proposals
- presents distributor events as claim-oriented cards with asset, funded, claimed, remaining, and active status details
- claims the remaining amount from one tracked funded distribution when the selected event is active and the connected wallet is on the right chain
- supports a narrow single-action governance proposal flow with vote, queue, and execute actions when the connected wallet and proposal state allow it

What it intentionally does not do yet:
- direct governance-owned bucket management
- direct treasury reclassification or distribution funding
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

5. In a browser with an injected wallet:
- connect the wallet to the dashboard
- switch the wallet to the same chain as the dashboard RPC if prompted
- use `Fund Treasury` to send ETH into treasury custody
- use the wallet panel’s local demo role guide to switch between the seeded Hardhat accounts
- use `Treasury Operating Actions` to prepare a narrow treasury proposal for budget allocation or bucket spend when the connected wallet has enough delegated votes
- review `Distributor Events` to see which tracked event is active and why it is or is not claimable
- use `Claim Distribution` to claim the remaining amount from the tracked seeded distribution

Suggested local demo roles:
- `Bootstrap admin` (`Hardhat account #0`)
  - deployer, bootstrap actor, and seeded governance driver
- `Governance participant` (`Hardhat account #1`)
  - secondary governance user seeded with delegated votes so you can demo non-bootstrap proposal and voting behavior
- `Treasury recipient` (`Hardhat account #2`)
  - recipient of the seeded operating spend
- `Distribution claimant` (`Hardhat account #3`)
  - suggested claimant for the seeded distribution demo
- `Viewer` (`Hardhat account #4`)
  - optional read-first wallet for observing the system without driving the seeded actor story

Important demo honesty note:
- these are local demo identities, not real product user accounts
- the current distribution claim path is still a simple self-claim flow, so the suggested claimant role is a demo convenience rather than an enforced on-chain allowlist

How a new user should use the guided flow:
- start with the `Guided Demo` section at the top of the page
- move step by step through treasury, buckets, distributor, governance control, and the activity feed
- use each step’s jump button to open the relevant live view in the seeded demo
- treat the walkthrough as the fastest way to understand the product story before trying wallet actions

Why the write actions are intentionally small:
- treasury classification, bucket policy, and distributor funding are timelock-owned after bootstrap
- those actions are meant to flow through governance, so the dashboard only exposes a very small proposal composer instead of direct module admin buttons
- treasury funding and self-claim distribution actions are the two meaningful interactions that fit the current MVP ownership model without bypassing governance

What the current treasury action forms support:
- direct ETH funding into treasury custody
- preparing a governance proposal to allocate budget to a tracked bucket
- preparing a governance proposal to spend from a tracked bucket to a recipient
- explaining the current MVP limitation that there is no separate on-chain create-bucket call, so a bucket effectively comes into existence on first allocation

What the current distributor claim view supports:
- showing tracked distribution events with asset, total amount, funded amount, claimed amount, remaining amount, and active or closed status
- explaining claim readiness in plain language, including wallet connection and chain-match requirements
- selecting an event from the distributor view and using the real self-claim flow for the full remaining funded amount
- being honest about the current MVP limitation that richer entitlement logic or proof-based claims are not part of this flow yet

What the current governance view supports:
- reading proposals from real governor events plus live on-chain proposal state
- creating a small set of honest single-action proposals that match the current governor contract
- voting, queueing, and executing proposals when the connected wallet is on the right chain and the proposal state allows it
- explaining when queueing or execution is blocked by proposal state or the timelock delay
- showing helpful lifecycle metadata such as created time, voting start and end blocks, queue time, and earliest execution time when practical
- showing the practical MVP limitation that broader multi-call governance actions are not in this UI yet because the governor contract itself is still intentionally single-action

What the current activity feed supports:
- treasury funding, capital classification, budget allocation, budget deallocation, and bucket spending
- distribution creation, funding, claims, and closure
- governance proposal creation, vote casting, queueing, and execution

What the current roles view supports:
- governance token owner
- treasury owner
- distributor owner
- timelock admin, proposer, and executor
- whether governor/timelock wiring appears aligned
- whether the system looks fully handed off or still in bootstrap / partial-handoff mode

What the current system health view supports:
- whether the core contract addresses are loaded into the dashboard
- treasury native custody and distributor outstanding amount
- active distribution count and tracked bucket load status
- whether the system looks bootstrap-managed or governance-controlled
- lightweight warnings when the treasury is unfunded, no active distributions are loaded, or governance handoff looks incomplete
- an honest note that these are direct-read MVP health signals, not a full monitoring backend

Current analytics compromise:
- the feed reads recent direct contract logs from the configured addresses over a recent block window
- there is no separate indexer or historical warehouse yet
- there is no dedicated bucket creation event in the current contracts, so allocation is the first visible bucket lifecycle event

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
- [docs/deployer-flow.md](/C:/Users/914al/governance-system-maker/docs/deployer-flow.md)

## Current Limits

This is still an MVP. It intentionally does not prioritize:
- advanced deployment orchestration
- complex permissions beyond the current owner/governor/timelock model
- richer distribution entitlement logic
- polished front-end productization
- broader cleanup of older placeholder files unless they improve near-term clarity
