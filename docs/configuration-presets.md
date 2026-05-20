# Configuration Presets

This note explains the first-pass deployment parameter presets for the governance capital MVP.

The goal is consistency, not a complex configuration platform.

## How Presets Work

The deploy config now combines:
- network metadata
- one named parameter preset

Current preset selection rules:
1. if `GOVCAP_DEPLOY_PRESET` is set, use it
2. otherwise use the default preset for that network

Current defaults:
- `hardhatMainnet` -> `local-demo`
- `localhost` -> `local-demo`
- `sepolia` -> `testnet-demo`

Supported presets:
- `local-demo`
- `testnet-demo`
- `conservative-governance`

## Preset Comparison

### `local-demo`

Use when:
- rehearsing locally
- running the seeded demo
- testing the full governance path without long waits

Main parameters:
- token supply: `1,000,000 GOVCAP`
- self-delegate initial votes: `true`
- timelock delay: `3600` seconds
- voting delay: `1` block
- voting period: `50` blocks
- proposal threshold: `10,000 GOVCAP`
- quorum numerator: `1000` basis points

### `testnet-demo`

Use when:
- deploying to a real public testnet
- keeping the same MVP architecture but using more realistic governance timing

Main parameters:
- token supply: `1,000,000 GOVCAP`
- self-delegate initial votes: `true`
- timelock delay: `86400` seconds
- voting delay: `1` block
- voting period: `7200` blocks
- proposal threshold: `10,000 GOVCAP`
- quorum numerator: `1000` basis points

### `conservative-governance`

Use when:
- you want a more cautious governance posture
- slower timing and higher participation thresholds are preferable

Main parameters:
- token supply: `1,000,000 GOVCAP`
- self-delegate initial votes: `true`
- timelock delay: `172800` seconds
- voting delay: `20` blocks
- voting period: `14400` blocks
- proposal threshold: `25,000 GOVCAP`
- quorum numerator: `1500` basis points

## Treasury And Distributor Assumptions

These presets do not change core treasury or distributor behavior.

They assume:
- treasury and distributor deploy with the bootstrap deployer as initial owner
- ownership is then handed to the timelock by the deploy script
- treasury starts unfunded until later seed or operational flows
- distributor starts with no distributions and no funded liabilities
- the current distributor claim model remains self-claim based

## How To Use A Preset

Local default:

```bash
npx hardhat run scripts/deploy-v3.ts --build-profile production --network localhost
```

Sepolia default:

```bash
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
```

Explicit preset override in PowerShell:

```powershell
$env:GOVCAP_DEPLOY_PRESET="conservative-governance"
npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia
```

If you set `GOVCAP_DEPLOY_PRESET`, the deployment output JSON will include the chosen preset key and label.

## Why This Is Still Intentionally Small

The current MVP does not need:
- many environment-specific forks
- per-module parameter files
- deep preset inheritance chains
- a config registry service

If the project later grows into multiple production instance classes, this area would need a stronger parameter governance process and likely stricter validation around allowed combinations.
