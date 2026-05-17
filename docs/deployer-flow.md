# Deployer Flow

The MVP now includes a first-pass launch planner in `frontend/`.

Its job is not to replace the current deployment model. Its job is to make that model easier to understand and review as a product-facing launch experience.

## What The Launch Planner Really Is

The `Launch System` section in the frontend is:
- a launch-parameter form
- a deployment review surface
- a command and config generator for the current script-based deploy flow

It is not:
- an on-chain factory
- a browser-native contract deployment backend
- a one-click production launch platform

## Current Deployment Truth

The actual deployment path today is still:
- [scripts/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/deploy-v3.ts)
- [scripts/config/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/config/deploy-v3.ts)

That script:
1. deploys `GovernanceToken`
2. deploys `Treasury`
3. deploys `Distributor`
4. deploys `GovernanceTimelock`
5. deploys `GovernanceGovernor`
6. performs the bootstrap-owner and timelock handoff sequence
7. prints deployment addresses and config output

## How The Frontend Maps To The Script

The launch planner mirrors the current architecture by showing:
- the selected network profile
- token identity and initial supply
- timelock bootstrap posture
- the module stack being deployed
- the expected ownership and handoff sequence
- the exact terminal deploy command

This makes the product story feel closer to “launch a governance capital system” while staying honest that the browser is preparing the launch rather than executing it directly.

## Why This Is A Good MVP Step

This approach keeps the repo aligned with reality:
- deployment remains deterministic and reviewable
- no fake factory abstraction is introduced
- the product direction becomes visible early
- later launch automation can build on the same flow instead of replacing it abruptly

## What A Fuller Factory Experience Would Need Later

A more complete launch product would likely need:
- a backend or trusted local agent that can actually run deployments from the UI
- secure secret and signer handling
- persisted deployment records
- network-specific verification and explorer integration
- optional on-chain factory semantics if the product truly moves in that direction

Those are intentionally out of scope for the current MVP.
