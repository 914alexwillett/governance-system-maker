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
- `scripts/prepare-distribution-claims.ts`
  - lightweight claim-artifact generator for seeded or repeatable Distributor demos
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

For an explicit preset override:

```powershell
$env:GOVCAP_DEPLOY_PRESET="conservative-governance"
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
npx hardhat run scripts/prepare-distribution-claims.ts --build-profile production --network hardhatMainnet
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
- `npx hardhat run scripts/prepare-distribution-claims.ts --build-profile production --network hardhatMainnet`
  - generate a lightweight Distributor claim artifact with current self-claim requests plus future-compatible Merkle data

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
10. print a claim package for the seeded distribution claimant

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

## Configuration Presets

Deployment parameters now use a small preset system so instance creation is more repeatable.

Included presets:
- `local-demo`
  - fast local governance timing for rehearsals, seeded demos, and test-friendly iteration
- `testnet-demo`
  - realistic public testnet timing without changing the MVP architecture
- `conservative-governance`
  - slower and stricter governance timing for a more cautious instance posture

Standardized parameters:
- token name and symbol
- initial token supply
- bootstrap self-delegation behavior
- timelock delay
- voting delay
- voting period
- proposal threshold
- quorum numerator
- treasury and distributor deployment assumptions

How preset selection works:
- `hardhatMainnet` defaults to `local-demo`
- `localhost` defaults to `local-demo`
- `sepolia` defaults to `testnet-demo`
- set `GOVCAP_DEPLOY_PRESET` to override the default choice

Example commands:

```bash
npx hardhat run scripts/deploy-v3.ts --build-profile production --network localhost
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
```

PowerShell preset override:

```powershell
$env:GOVCAP_DEPLOY_PRESET="conservative-governance"
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
```

See:
- [scripts/config/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/config/deploy-v3.ts)
- [docs/configuration-presets.md](/C:/Users/914al/governance-system-maker/docs/configuration-presets.md)

## Demo Dashboard

The repo now includes a minimal local launch planner and dashboard under `frontend/`.

## Launch New Instance

The first-pass launcher UX is intentionally honest about the current architecture.

What it does:
- collects a small launch profile such as network, token identity, initial supply, and timelock delay
- shows the exact module stack that the MVP deployment script will deploy
- shows the ownership and governance handoff sequence
- generates the real deploy command, env setup, launch packet, and config preview that map to `scripts/deploy-v3.ts`
- helps you paste a real deployment output JSON back into the dashboard so the new instance can be inspected immediately

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

3. Use the `Launch New Instance` section to:
- choose a local or Sepolia launch profile
- set the small set of launch parameters exposed in the MVP planner
- review the deploy command, env requirements, config preview, readiness checklist, and handoff steps
- optionally download a launch packet for sharing or operator handoff
- run the real deploy command in a terminal
- paste the resulting `Deployment Output (JSON)` back into the launcher to configure the dashboard for the new instance

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
- includes a lightweight governance analytics view for proposal mix, recent activity, and recorded voting participation
- reads governance proposals, vote totals, and proposal status
- shows a role and control view for ownership and governance relationships
- shows a compact system health view for funding, handoff posture, and basic readiness signals
- shows an ops/admin-oriented view for operator status, blocked actions, and the small set of governance-adjacent flows exposed today
- includes a clearly labeled sandbox mode for preview-only treasury, distributor, and governance what-if exploration
- includes a lightweight budget runway view for tracked treasury buckets under simple burn assumptions
- includes a guided distribution campaign setup flow for event inputs, funding assumptions, and claim tooling expectations
- reads timelock ownership wiring
- shows a lightweight recent activity feed from treasury, distributor, and governor logs
- can export or reload a shareable demo-state bundle for repeated dashboard demos
- connects an injected wallet such as MetaMask
- funds treasury ETH custody directly from the connected wallet
- exposes a small treasury action form for bucket allocation and bucket spend proposals
- presents distributor events as claim-oriented cards with asset, funded, claimed, remaining, and active status details
- claims the remaining amount from one tracked funded distribution when the selected event is active and the connected wallet is on the right chain
- supports a narrow single-action governance proposal flow with vote, queue, and execute actions when the connected wallet and proposal state allow it

What the current launcher flow supports:
- reviewing the module stack for a new instance before deployment
- preparing a launch packet with command, env setup, config preview, handoff steps, and next steps
- staying honest that deployment still happens through the off-chain Hardhat script
- loading the real deploy script JSON output back into the dashboard after launch

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

To reuse or share a demo setup:
- use `Copy shareable state` to copy a reusable dashboard bundle
- use `Download state file` to save that bundle as JSON
- use `Load state file` or paste JSON into `Paste shared demo state or seeded JSON` on another local dashboard instance
- you can also paste the `Seeded State (JSON)` block printed by `npm run seed:demo:ui`

## Instance Management

The dashboard now includes an `Instance Shelf` for lightweight multi-instance work.

What it is:
- a browser-local list of known instances
- built from real deployment output JSON, shared demo-state bundles, seeded demo JSON, or a manually saved dashboard config
- a convenience layer for switching between systems, not a hosted backend or authoritative registry
- includes a lightweight side-by-side comparison flow for two saved instances

What gets stored for each instance:
- RPC URL
- deployed contract addresses
- tracked bucket ids
- tracked distribution ids
- small convenience metadata such as source, network label, and last saved time

How to use it:

1. Start the dashboard:

```bash
npm run ui:dev
```

2. Open:

```text
http://127.0.0.1:4173
```

3. Build your shelf in one of three ways:
- paste real `Deployment Output (JSON)` into `Launch New Instance`
- load a previously exported shareable demo-state file
- point the dashboard at a system manually, then click `Save current dashboard as instance`

4. Use `Known Instances` to switch between saved systems.

5. Use `Compare Two Instances` to load a live side-by-side view from any two saved shelf records.

How instance discovery works today:
- there is no backend instance index yet
- the shelf is populated only from the data you import or save in this browser
- live health, control posture, and balances still come from direct reads against the selected RPC and contracts

What the current comparison view shows:
- instance identity and source
- network and RPC availability
- governor and timelock identity
- governance posture and top-level governance parameters
- treasury custody and available operating capital
- distributor outstanding amount and active distribution count
- proposal count and tracked bucket or distribution load summaries

What it intentionally omits:
- a full config diff engine
- historical comparisons across time
- deeper per-bucket, per-distribution, or per-proposal diffing

## Ops And Admin View

The dashboard now includes a lightweight `Ops And Admin View` for technically literate operators.

What it highlights:
- current ownership and governance control posture
- treasury operating readiness and available operating capital
- distributor claim readiness and outstanding obligations
- warnings or blockers drawn from direct contract reads
- which currently supported actions are available now versus blocked by wallet state, governance posture, or timelock lifecycle

How to interpret it:
- `Control status` tells you whether the instance still looks bootstrap-managed or properly handed off into the governor plus timelock path
- `Treasury operations` focuses on whether custody is funded and whether operating capital still looks usable
- `Distributor operations` focuses on whether a meaningful tracked distribution flow is still live
- `Available Now` only describes real MVP actions already exposed elsewhere in the UI; it does not imply broader hidden admin powers

MVP compromise:
- this is a direct-read operator summary, not a full monitoring or incident-response console
- blocked or available action summaries are intentionally narrow and reflect the existing wallet, governance, and claim flows already implemented in the dashboard

## Sandbox Mode

The dashboard now includes a lightweight `Sandbox Mode` for safe experimentation.

What it is:
- a preview-only layer built on top of the current live dashboard state
- a way to explore a few treasury, distributor, and governance what-if scenarios without sending transactions
- a demo-oriented learning tool, not a full simulation engine

What is simulated:
- classifying operating capital
- allocating or spending from a tracked bucket
- funding or claiming against a tracked distribution
- the rough lifecycle timing of a new governance proposal created now

What is still real:
- all live balances, roles, proposal states, and distribution states elsewhere in the dashboard
- all actual wallet-connected actions in `Wallet And Actions`

Important boundary:
- sandbox results are UI-only previews
- they do not modify chain state
- they do not predict vote outcomes or guarantee execution readiness beyond the current timing parameters

## Governance Analytics

The dashboard now includes a lightweight `Governance Analytics` view.

What it currently shows:
- total proposal count
- proposal counts by state
- recent proposal activity
- recorded votes cast across current proposals
- average and peak recorded vote totals
- whether proposals have reached success, queueing, or execution stages

How the numbers are derived:
- proposal activity comes from the current governor proposal reads already used by the dashboard
- vote participation is based on the live `for`, `against`, and `abstain` tallies on each visible proposal
- queue and execution signals come from the real governor and timelock lifecycle state

Important limitation:
- this MVP view shows a participation proxy, not authoritative turnout against the full eligible voter base
- it does not currently index historical total-supply snapshots or a richer governance analytics backend

## Budget Runway

The dashboard now includes a lightweight `Budget Runway` view for tracked treasury buckets.

What it currently shows:
- actual allocated amount
- actual spent amount
- actual remaining amount
- spent ratio
- a user-provided monthly burn assumption
- an estimated runway in months and approximate days

How the forecast is derived:
- bucket balances come from the current live treasury read model
- the runway estimate divides the bucket's current remaining amount by the assumed monthly burn

Important limitation:
- this is a simple forecast, not a financial planning engine
- it does not model new funding, variable burn, governance timing, or future policy changes

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

## Distribution Campaign Setup

The dashboard now includes a lightweight `Distribution Campaign Setup` flow.

What it helps explain:
- what a distribution event is
- which distribution id and amount inputs are required
- how much you plan to fund now versus later
- how many recipients you expect to support
- whether you are working in today's self-claim model or preparing future-compatible claim artifacts

What is truly supported now:
- the Distributor contract really does support event creation, funding, and self-claiming
- the live governance panel can currently create the first tracked distribution as a real proposal
- the claim tooling script can generate a repeatable claim artifact and current claim-request shape for demos or tests

What is still guided-only:
- a full end-to-end campaign wizard in the UI
- governed funding actions for new campaigns in one productized flow
- on-chain proof enforcement or richer entitlement management

Useful local flow:
1. Start the local chain and seeded demo dashboard.
2. Open `Distribution Campaign Setup`.
3. Choose a tracked distribution template and enter total amount, initial funding, recipient count, and claim model.
4. Use the setup summary to understand which parts belong to on-chain event creation, governed funding, and off-chain claim tooling.
5. If you need a claim package, run the claim-artifact script:

```bash
npx hardhat run scripts/prepare-distribution-claims.ts --build-profile production --network hardhatMainnet
```

## Distributor Claim Tooling

The current MVP Distributor does not verify Merkle proofs on-chain yet. Claims are still simple self-claims:

- `distributionId`
- `recipient`
- `amount`

To make that flow easier to test, seed, and explain, the repo now includes a lightweight claim-artifact generator:

```bash
npx hardhat run scripts/prepare-distribution-claims.ts --build-profile production --network hardhatMainnet
```

What it produces:
- the exact current MVP `claim` request payload shape for the seeded claimant
- a deterministic claim leaf
- a future-compatible Merkle root
- a Merkle proof array for each listed claim entry
- notes that explain which parts are usable today and which parts are future-oriented

How it relates to the current claim flow:
- `currentMvpClaimRequest` is usable with the current Distributor contract today
- `merkleRoot` and `merkleProof` are explanatory and test/demo-friendly artifacts for a richer entitlement model later

The local demo seed also now includes this claim artifact inside its printed `Seeded State (JSON)` output, so a demo operator can copy one bundle that includes:
- deployed addresses
- seeded actor roles
- tracked distribution id
- claim package data for the seeded distribution claimant

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

What the current shareable demo-state flow supports:
- exporting the current dashboard RPC URL, deployed addresses, and tracked bucket and distribution ids
- including convenience demo metadata such as local demo actors, history settings, and a small live-status snapshot when available
- reloading that bundle into another local dashboard instance
- importing the local seed script JSON output as a shortcut to rebuild dashboard config

What it does not export:
- private keys or wallet secrets
- a full chain snapshot
- historical storage beyond the small convenience metadata included in the bundle

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

- [docs/audit-readiness.md](/C:/Users/914al/governance-system-maker/docs/audit-readiness.md)
- [docs/configuration-presets.md](/C:/Users/914al/governance-system-maker/docs/configuration-presets.md)
- [docs/module-review-guide.md](/C:/Users/914al/governance-system-maker/docs/module-review-guide.md)
- [docs/README.md](/C:/Users/914al/governance-system-maker/docs/README.md)
- [docs/developer-workflow.md](/C:/Users/914al/governance-system-maker/docs/developer-workflow.md)
- [docs/deployer-flow.md](/C:/Users/914al/governance-system-maker/docs/deployer-flow.md)

## Audit Readiness

The repo now includes a small reviewer-oriented documentation layer for faster internal or external review preparation.

Useful starting points:
- [docs/audit-readiness.md](/C:/Users/914al/governance-system-maker/docs/audit-readiness.md)
  - architecture, trust assumptions, ownership flow, invariants, and MVP limitations
- [docs/module-review-guide.md](/C:/Users/914al/governance-system-maker/docs/module-review-guide.md)
  - module boundaries, sensitive behaviors, and suggested review focus areas

These notes are intentionally scoped:
- they describe what is implemented now
- they call out what is intentionally postponed
- they do not claim that a full independent security audit has already happened

## Current Limits

This is still an MVP. It intentionally does not prioritize:
- advanced deployment orchestration
- complex permissions beyond the current owner/governor/timelock model
- richer distribution entitlement logic
- polished front-end productization
- broader cleanup of older placeholder files unless they improve near-term clarity
