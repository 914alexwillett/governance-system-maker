# AGENTS.md

You are working in a new repository for a governance-controlled capital operating system MVP.

Before changing code, read:
1. `PLANS.md`
2. `README.md`

## Product vision

This project is building a governance-controlled capital operating system where treasury assets are:
- custodied
- classified
- budgeted
- either spent or distributed through explicit policy-driven flows

Core modules:
- GovernanceToken
- GovernanceGovernor
- GovernanceTimelock
- Treasury
- Distributor
- off-chain deployment / initialization pipeline

## Product philosophy

- MVP first
- preserve the long-term architecture
- prefer simple, demonstrable flows before advanced hardening
- small, reviewable diffs
- one scoped task at a time
- no large speculative rewrites

## Engineering workflow

- Each task should be narrowly scoped
- Prefer one branch or worktree per task
- Keep changes local to the requested module
- Do not rewrite adjacent modules unless necessary for correctness
- If a task appears to require a broad refactor, stop and explain why before proceeding

## Coding rules

- Follow existing repo conventions
- Prefer clarity over cleverness
- Prefer minimal dependencies
- Keep contracts modular and readable
- Keep scripts deterministic where possible
- Keep tests aligned with actual module boundaries and ownership flow
- Preserve invariants when modifying accounting or governance logic

## Definition of done

A task is only done if:
- code compiles
- the scoped verification command passes
- no unrelated files were changed
- the diff is understandable
- tradeoffs and follow-ups are summarized clearly

## High-priority invariants

- Treasury accounting must never exceed actual balances
- Bucket spending must not exceed allocated capital
- Distributor claims must never exceed funded event amounts
- Governance-controlled modules must remain consistent with the intended ownership / timelock model

## How to respond when implementing

For each task:
1. briefly restate the task
2. describe what files will be changed
3. implement only the scoped change
4. summarize what changed
5. mention any risks, assumptions, or follow-up work