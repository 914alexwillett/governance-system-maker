# Launcher Flow

The MVP now includes a first-pass launcher in `frontend/`.

Its job is not to replace the current deployment model. Its job is to make that model easier to understand and review as a product-facing launch experience.

## What The Launcher Really Is

The `Launch New Instance` section in the frontend is:
- a launch-parameter form
- a deployment review surface
- a command, env, and launch-packet generator for the current script-based deploy flow
- a bridge back into the dashboard after deployment output is available

It is not:
- an on-chain factory
- a browser-native contract deployment backend
- a one-click production launch platform

## Current Deployment Truth

The actual deployment path today is still:
- [scripts/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/deploy-v3.ts)
- [scripts/config/deploy-v3.ts](/C:/Users/914al/governance-system-maker/scripts/config/deploy-v3.ts)
- [docs/configuration-presets.md](/C:/Users/914al/governance-system-maker/docs/configuration-presets.md)

That script:
1. deploys `GovernanceToken`
2. deploys `Treasury`
3. deploys `Distributor`
4. deploys `GovernanceTimelock`
5. deploys `GovernanceGovernor`
6. performs the bootstrap-owner and timelock handoff sequence
7. prints deployment addresses and config output

## How The Frontend Maps To The Script

The launcher mirrors the current architecture by showing:
- the selected network profile
- the implied or overridden deployment preset
- token identity and initial supply
- timelock bootstrap posture
- the module stack being deployed
- the expected ownership and handoff sequence
- the exact terminal deploy command
- any required environment values
- a post-launch step that loads the real deployment output JSON into the dashboard

This makes the product story feel closer to a reusable launch experience while staying honest that the browser is preparing the launch rather than executing it directly.

## First-Pass User Flow

1. Open the local UI and go to `Launch New Instance`.
2. Choose the network profile and fill in the small set of launch parameters.
3. Review module creation, handoff steps, and readiness notes.
4. Copy the env setup, deploy command, or download the launch packet.
5. Run the real deploy command in a terminal.
6. Paste the resulting `Deployment Output (JSON)` back into the launcher.
7. Use the dashboard to inspect the new instance.

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
