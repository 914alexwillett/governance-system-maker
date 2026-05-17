import { demoDefaults } from "./demo-config.js";
import {
  deployerDefaults,
  deploymentBlueprint,
  deploymentProfiles,
} from "./deployer-config.js";
import { getNativeAssetAddress, loadDashboardState } from "./rpc.js";
import {
  chainLabel,
  claimDistribution,
  connectWallet,
  ensureWalletOnChain,
  fundTreasury,
  getWalletState,
  parseEthAmount,
  shortenAddress,
  waitForTransactionReceipt,
  watchWalletChanges,
} from "./wallet.js";

const CONFIG_STORAGE_KEY = "governance-capital-demo-config-v1";
const DEPLOYER_STORAGE_KEY = "governance-capital-launch-config-v1";
const GUIDED_DEMO_STORAGE_KEY = "governance-capital-guided-demo-step-v1";

const GUIDED_DEMO_STEPS = [
  {
    title: "Start with the MVP story",
    body: "This system holds capital in treasury custody, classifies that capital by purpose, commits some of it into operating buckets, and uses governance plus a timelock as the control path for policy changes.",
    targetId: "deployment-summary-section",
    targetLabel: "Open deployment summary",
    checklist: [
      "Notice the five main modules: token, governor, timelock, treasury, and distributor.",
      "Treat the seeded demo as a realistic post-deployment operating snapshot, not just a toy balance screen.",
    ],
  },
  {
    title: "See what the treasury does",
    body: "The treasury is where capital sits first. It tracks how much capital exists, how much is still unallocated, and how much has already been classified for operating or distributable purposes.",
    targetId: "treasury-state-section",
    targetLabel: "View treasury state",
    checklist: [
      "Look at total native custody to see how much ETH the treasury currently holds.",
      "Compare unallocated capital with operating classified capital to understand what has been committed by policy.",
    ],
  },
  {
    title: "Understand budget buckets",
    body: "Budget buckets are named operating commitments. They let governance carve out part of operating capital for a specific purpose and then spend against that bucket without losing accounting visibility.",
    targetId: "budget-buckets-section",
    targetLabel: "Inspect budget buckets",
    checklist: [
      "Check allocated, spent, and remaining values for the tracked demo bucket.",
      "Use the activity feed later to see when that bucket was allocated and spent.",
    ],
  },
  {
    title: "Understand the distributor",
    body: "The distributor manages discrete payout events. Governance can create and fund a distribution, then recipients claim against that event. In the seeded demo, one distribution is intentionally left claimable.",
    targetId: "distributor-events-section",
    targetLabel: "Inspect distributor events",
    checklist: [
      "Look for the tracked demo community grant and its funded versus claimed amounts.",
      "If you connect a wallet on the local seeded chain, the claim action shows the last step in the seeded story.",
    ],
  },
  {
    title: "Understand governance and timelock control",
    body: "In this MVP, governance does not act on treasury or distributor modules directly. The governor approves actions, the timelock delays them, and the timelock ends up as the owner boundary for governed modules after handoff.",
    targetId: "roles-control-section",
    targetLabel: "Review roles and control",
    checklist: [
      "Use the roles view to see who currently controls token, treasury, distributor, and timelock roles.",
      "Use the timelock wiring section to confirm whether the system looks fully handed off or still partly bootstrap-controlled.",
    ],
  },
  {
    title: "Follow the seeded demo over time",
    body: "The Activity Feed helps you read the seeded story as a sequence: treasury funding, capital classification, bucket allocation, spending, distribution creation, distribution funding, and any later claims or governance actions.",
    targetId: "activity-feed-section",
    targetLabel: "Open activity feed",
    checklist: [
      "Read from older treasury setup steps toward newer governance and claim activity.",
      "Treat this feed as a lightweight recent-history view built directly from contract logs, not a full analytics platform yet.",
    ],
  },
];

const deployerForm = document.querySelector("#deployer-form");
const deployerStatusBanner = document.querySelector("#deployer-status-banner");
const launchSummaryPanel = document.querySelector("#launch-summary-panel");
const launchModulesPanel = document.querySelector("#launch-modules-panel");
const launchHandoffPanel = document.querySelector("#launch-handoff-panel");
const launchCommandPanel = document.querySelector("#launch-command-panel");
const guidedDemoPanel = document.querySelector("#guided-demo-panel");
const resetDeployerDefaultsButton = document.querySelector("#reset-deployer-defaults");
const copyLaunchCommandButton = document.querySelector("#copy-launch-command");
const copyLaunchConfigButton = document.querySelector("#copy-launch-config");

const form = document.querySelector("#config-form");
const statusBanner = document.querySelector("#status-banner");
const writeStatusBanner = document.querySelector("#write-status-banner");
const summaryPanel = document.querySelector("#summary-panel");
const treasuryPanel = document.querySelector("#treasury-panel");
const bucketsPanel = document.querySelector("#buckets-panel");
const distributorPanel = document.querySelector("#distributor-panel");
const rolesPanel = document.querySelector("#roles-panel");
const timelockPanel = document.querySelector("#timelock-panel");
const historyPanel = document.querySelector("#history-panel");
const notePanel = document.querySelector("#note-panel");
const walletPanel = document.querySelector("#wallet-panel");
const resetButton = document.querySelector("#reset-defaults");
const connectWalletButton = document.querySelector("#connect-wallet");
const switchWalletNetworkButton = document.querySelector("#switch-wallet-network");
const fundTreasuryForm = document.querySelector("#fund-treasury-form");
const claimDistributionForm = document.querySelector("#claim-distribution-form");
const claimDistributionSelect = document.querySelector("#claim-distribution-select");
const claimPreview = document.querySelector("#claim-preview");
const fundTreasuryButton = document.querySelector("#fund-treasury-button");
const claimDistributionButton = document.querySelector("#claim-distribution-button");

let latestState = null;
let latestConfig = null;
let latestLaunchPlan = null;
let guidedDemoStepIndex = loadGuidedDemoStepIndex();
let walletState = {
  available: false,
  account: null,
  chainId: null,
};

bootstrap();

async function bootstrap() {
  renderGuidedDemo();

  const deployerConfig = loadStoredDeployerConfig();
  hydrateDeployerForm(deployerConfig);
  renderLaunchPlan(buildLaunchPlan(deployerConfig));

  deployerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleGenerateLaunchPlan();
  });

  resetDeployerDefaultsButton.addEventListener("click", () => {
    hydrateDeployerForm(structuredClone(deployerDefaults));
    handleGenerateLaunchPlan();
  });

  copyLaunchCommandButton.addEventListener("click", async () => {
    await handleCopyLaunchCommand();
  });

  copyLaunchConfigButton.addEventListener("click", async () => {
    await handleCopyLaunchConfig();
  });

  const config = loadStoredConfig();
  hydrateForm(config);
  latestConfig = config;
  walletState = await getWalletState();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await refresh();
  });

  resetButton.addEventListener("click", async () => {
    hydrateForm(structuredClone(demoDefaults));
    await refresh();
  });

  connectWalletButton.addEventListener("click", async () => {
    await handleConnectWallet();
  });

  switchWalletNetworkButton.addEventListener("click", async () => {
    await handleSwitchWalletNetwork();
  });

  fundTreasuryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleFundTreasury();
  });

  claimDistributionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleClaimDistribution();
  });

  claimDistributionSelect.addEventListener("change", () => {
    renderClaimPreview();
  });

  watchWalletChanges(async () => {
    walletState = await getWalletState();
    renderWalletPanel();
    renderClaimPreview();
  });

  renderWalletPanel();
  renderClaimPreview();
  void refresh();
}

function handleGenerateLaunchPlan() {
  try {
    const config = readDeployerFormConfig();
    const launchPlan = buildLaunchPlan(config);
    storeDeployerConfig(config);
    renderLaunchPlan(launchPlan);
    setDeployerStatus(
      `Launch plan ready for ${launchPlan.systemLabel} on ${launchPlan.profile.label}.`,
      "success",
    );
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  }
}

async function refresh() {
  const config = readFormConfig();
  latestConfig = config;
  storeConfig(config);
  setStatus("Loading live contract state from the configured RPC endpoint.", "loading");

  try {
    const state = await loadDashboardState(config);
    latestState = state;
    renderSummary(config, state);
    renderTreasury(state.treasury);
    renderBuckets(state.treasury.buckets);
    renderDistributor(state.distributor);
    renderRoles(state);
    renderTimelock(state.timelock);
    renderHistory(state.history);
    renderNotes(config, state);
    renderWalletPanel();
    hydrateClaimSelector(config, state);
    renderClaimPreview();
    setStatus("Dashboard updated from the current chain state.", "success");
  } catch (error) {
    latestState = null;
    clearPanels();
    renderWalletPanel();
    renderClaimPreview();
    setStatus(
      `${toMessage(error)} Check that the local chain is running and the configured addresses match the latest seeded deployment.`,
      "error",
    );
  }
}

async function handleConnectWallet() {
  try {
    setWriteStatus("Requesting wallet connection.", "loading");
    walletState = await connectWallet();
    renderWalletPanel();
    renderClaimPreview();
    setWriteStatus(
      `Connected ${shortenAddress(walletState.account)} on ${chainLabel(walletState.chainId)}.`,
      "success",
    );
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

async function handleSwitchWalletNetwork() {
  try {
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();

    setWriteStatus("Switching the connected wallet to the dashboard network.", "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);
    walletState = await getWalletState();
    renderWalletPanel();
    renderClaimPreview();
    setWriteStatus(`Wallet switched to ${chainLabel(rpcChainId)}.`, "success");
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

async function handleFundTreasury() {
  try {
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();
    const amountWei = parseEthAmount(fundTreasuryForm.amountEth.value);

    if (amountWei <= 0n) {
      throw new Error("Funding amount must be greater than zero.");
    }

    setWriteStatus("Preparing treasury funding transaction.", "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await fundTreasury({
      treasuryAddress: config.addresses.treasury,
      amountWei,
    });

    setWriteStatus(`Treasury funding submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    await refresh();
    setWriteStatus(
      `Treasury funding confirmed for ${formatEth(amountWei)}.`,
      "success",
    );
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

async function handleClaimDistribution() {
  try {
    const config = requireConfig();
    const state = requireState();
    const rpcChainId = requireRpcChainId();
    const distribution = state.distributor.distributions.find(
      (item) => item.id === claimDistributionSelect.value,
    );

    if (distribution === undefined || distribution.status !== "loaded") {
      throw new Error("Choose a tracked funded distribution first.");
    }

    const claimableAmount = distribution.fundedAmount - distribution.claimedAmount;
    if (distribution.stateCode !== 1 || claimableAmount <= 0n) {
      throw new Error("The selected distribution is not currently claimable.");
    }

    if (walletState.account === null) {
      throw new Error("Connect a wallet before claiming a distribution.");
    }

    setWriteStatus("Preparing distribution claim transaction.", "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await claimDistribution({
      distributorAddress: config.addresses.distributor,
      distributionId: distribution.id,
      recipient: walletState.account,
      amountWei: claimableAmount,
    });

    setWriteStatus(`Distribution claim submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    await refresh();
    setWriteStatus(
      `Claim confirmed for ${distribution.label}: ${formatEth(claimableAmount)}.`,
      "success",
    );
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

function renderLaunchPlan(launchPlan) {
  latestLaunchPlan = launchPlan;

  launchSummaryPanel.innerHTML = `
    ${metricCard("System", launchPlan.systemLabel)}
    ${metricCard("Profile", launchPlan.profile.label)}
    ${metricCard("Network key", launchPlan.profile.networkName)}
    ${metricCard("Deploy mode", launchPlan.profile.deployMode)}
    ${metricCard("Initial supply", `${formatTokenCount(launchPlan.configPreview.token.initialSupply)} GOV`)}
    ${metricCard("Timelock delay", formatSeconds(BigInt(launchPlan.configPreview.timelock.minDelay)))}
  `;

  launchModulesPanel.innerHTML = launchPlan.modules
    .map((module) => `
      <div class="launch-module-card">
        <span class="eyebrow">${escapeHtml(module.label)}</span>
        <strong>${escapeHtml(module.purpose)}</strong>
      </div>
    `)
    .join("");

  launchHandoffPanel.innerHTML = `
    <ol class="sequence-list">
      ${launchPlan.handoffSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
    </ol>
  `;

  const envVars = launchPlan.envVars.length === 0
    ? "<p class=\"empty-state\">No extra environment values are required for this profile.</p>"
    : `
      <div class="callout-block">
        <strong>Required environment values</strong>
        <ul class="notes-list compact-list">
          ${launchPlan.envVars.map((value) => `<li><code>${escapeHtml(value)}</code></li>`).join("")}
        </ul>
      </div>
      <pre class="code-block">${escapeHtml(launchPlan.envExample)}</pre>
    `;

  launchCommandPanel.innerHTML = `
    <p class="action-copy">
      This planner does not deploy by itself. It prepares the same off-chain flow
      that <code>scripts/deploy-v3.ts</code> runs in the terminal.
    </p>
    <div class="callout-block">
      <strong>Deploy command</strong>
      <pre class="code-block">${escapeHtml(launchPlan.command)}</pre>
    </div>
    ${envVars}
    <div class="callout-block">
      <strong>Config preview</strong>
      <pre class="code-block">${escapeHtml(JSON.stringify(launchPlan.configPreview, null, 2))}</pre>
    </div>
    <div class="callout-block">
      <strong>Profile notes</strong>
      <ul class="notes-list compact-list">
        ${launchPlan.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderGuidedDemo() {
  const step = GUIDED_DEMO_STEPS[guidedDemoStepIndex];
  const canGoBack = guidedDemoStepIndex > 0;
  const canGoForward = guidedDemoStepIndex < GUIDED_DEMO_STEPS.length - 1;

  guidedDemoPanel.innerHTML = `
    <div class="guided-demo-shell">
      <div class="guided-demo-progress">
        <span class="eyebrow">Step ${guidedDemoStepIndex + 1} of ${GUIDED_DEMO_STEPS.length}</span>
        <strong>${escapeHtml(step.title)}</strong>
        <p>${escapeHtml(step.body)}</p>
      </div>
      <div class="guided-demo-actions">
        <div class="button-row compact-row">
          <button ${canGoBack ? "" : "disabled"} data-guided-action="back" type="button">Previous step</button>
          <button ${canGoForward ? "" : "disabled"} data-guided-action="next" type="button">Next step</button>
          <button data-guided-action="jump" data-target-id="${escapeHtml(step.targetId)}" type="button" class="ghost-button">
            ${escapeHtml(step.targetLabel)}
          </button>
        </div>
        <ol class="guided-demo-list">
          ${step.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>
      </div>
      <div class="guided-demo-stepper">
        ${GUIDED_DEMO_STEPS.map((item, index) => `
          <button
            type="button"
            class="guided-step-chip${index === guidedDemoStepIndex ? " is-active" : ""}"
            data-guided-action="select"
            data-guided-step="${index}"
          >
            ${index + 1}. ${escapeHtml(item.title)}
          </button>
        `).join("")}
      </div>
    </div>
  `;

  guidedDemoPanel.querySelectorAll("[data-guided-action]").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.guidedAction;

      if (action === "back" && guidedDemoStepIndex > 0) {
        guidedDemoStepIndex -= 1;
        storeGuidedDemoStepIndex(guidedDemoStepIndex);
        renderGuidedDemo();
        return;
      }

      if (action === "next" && guidedDemoStepIndex < GUIDED_DEMO_STEPS.length - 1) {
        guidedDemoStepIndex += 1;
        storeGuidedDemoStepIndex(guidedDemoStepIndex);
        renderGuidedDemo();
        return;
      }

      if (action === "select") {
        guidedDemoStepIndex = Number(element.dataset.guidedStep);
        storeGuidedDemoStepIndex(guidedDemoStepIndex);
        renderGuidedDemo();
        return;
      }

      if (action === "jump") {
        document.querySelector(`#${element.dataset.targetId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
}

function renderSummary(config, state) {
  summaryPanel.innerHTML = `
    <div class="stat-card">
      <span class="eyebrow">RPC</span>
      <strong>${escapeHtml(config.rpcUrl)}</strong>
    </div>
    <div class="stat-card">
      <span class="eyebrow">RPC chain</span>
      <strong>${escapeHtml(chainLabel(state.rpcChainId))}</strong>
    </div>
    <div class="stat-card">
      <span class="eyebrow">Governance Token</span>
      <code>${escapeHtml(state.addresses.governanceToken)}</code>
    </div>
    <div class="stat-card">
      <span class="eyebrow">Treasury</span>
      <code>${escapeHtml(state.addresses.treasury)}</code>
    </div>
    <div class="stat-card">
      <span class="eyebrow">Distributor</span>
      <code>${escapeHtml(state.addresses.distributor)}</code>
    </div>
    <div class="stat-card">
      <span class="eyebrow">Timelock</span>
      <code>${escapeHtml(state.addresses.governanceTimelock)}</code>
    </div>
  `;
}

function renderTreasury(treasury) {
  treasuryPanel.innerHTML = `
    <div class="panel-grid">
      ${metricCard("Owner", treasury.owner)}
      ${metricCard("Total native custody", formatEth(treasury.totalBalance))}
      ${metricCard("Operating classified", formatEth(treasury.operating))}
      ${metricCard("Distributable classified", formatEth(treasury.distributable))}
      ${metricCard("Available operating", formatEth(treasury.availableOperating))}
      ${metricCard("Unallocated", formatEth(treasury.unallocated))}
    </div>
  `;
}

function renderBuckets(buckets) {
  bucketsPanel.innerHTML = buckets.length === 0
    ? emptyState("No tracked bucket ids are configured yet.")
    : `
      <div class="list-table">
        <div class="list-head">
          <span>Bucket</span>
          <span>Allocated</span>
          <span>Spent</span>
          <span>Remaining</span>
        </div>
        ${buckets.map((bucket) => {
          if (bucket.status === "error") {
            return `
              <div class="list-row error-row">
                <span>
                  <strong>${escapeHtml(bucket.label)}</strong>
                  <code>${escapeHtml(bucket.id)}</code>
                </span>
                <span class="full-row" data-span="3">${escapeHtml(bucket.error)}</span>
              </div>
            `;
          }

          return `
            <div class="list-row">
              <span>
                <strong>${escapeHtml(bucket.label)}</strong>
                <code>${escapeHtml(bucket.id)}</code>
              </span>
              <span>${formatEth(bucket.allocated)}</span>
              <span>${formatEth(bucket.spent)}</span>
              <span>${formatEth(bucket.remaining)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
}

function renderDistributor(distributor) {
  distributorPanel.innerHTML = `
    <div class="panel-grid compact">
      ${metricCard("Owner", distributor.owner)}
      ${metricCard("Total outstanding", formatEth(distributor.totalOutstanding))}
    </div>
    <div class="list-table">
      <div class="list-head distributor-head">
        <span>Distribution</span>
        <span>Total</span>
        <span>Funded</span>
        <span>Claimed</span>
        <span>Status</span>
      </div>
      ${distributor.distributions.map((distribution) => {
        if (distribution.status === "error") {
          return `
            <div class="list-row error-row distributor-row">
              <span>
                <strong>${escapeHtml(distribution.label)}</strong>
                <code>${escapeHtml(distribution.id)}</code>
              </span>
              <span class="full-row" data-span="4">${escapeHtml(distribution.error)}</span>
            </div>
          `;
        }

        return `
          <div class="list-row distributor-row">
            <span>
              <strong>${escapeHtml(distribution.label)}</strong>
              <code>${escapeHtml(distribution.id)}</code>
            </span>
            <span>${formatEth(distribution.totalAmount)}</span>
            <span>${formatEth(distribution.fundedAmount)}</span>
            <span>${formatEth(distribution.claimedAmount)}</span>
            <span>${distributionStatus(distribution.stateCode)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderRoles(state) {
  const roleView = deriveRoleView(state);

  rolesPanel.innerHTML = `
    <div class="roles-overview">
      <div class="role-status-card" data-mode="${escapeHtml(roleView.modeTone)}">
        <span class="eyebrow">Control mode</span>
        <strong>${escapeHtml(roleView.modeLabel)}</strong>
        <p>${escapeHtml(roleView.modeDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(roleView.pathTone)}">
        <span class="eyebrow">Governance path</span>
        <strong>${escapeHtml(roleView.pathLabel)}</strong>
        <p>${escapeHtml(roleView.pathDetail)}</p>
      </div>
    </div>
    <div class="roles-grid">
      ${roleView.rows.map((row) => `
        <article class="role-card">
          <div class="role-card-head">
            <strong>${escapeHtml(row.label)}</strong>
            <span class="role-badge" data-tone="${escapeHtml(row.tone)}">${escapeHtml(row.status)}</span>
          </div>
          <p class="role-card-copy">${escapeHtml(row.copy)}</p>
          <div class="role-card-meta">
            <span class="eyebrow">Current controller</span>
            <code>${escapeHtml(row.controller)}</code>
          </div>
          <div class="role-card-meta">
            <span class="eyebrow">Expected steady state</span>
            <span>${escapeHtml(row.expected)}</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderTimelock(timelock) {
  timelockPanel.innerHTML = `
    <div class="panel-grid">
      ${metricCard("Admin", timelock.admin)}
      ${metricCard("Proposer", timelock.proposer)}
      ${metricCard("Executor", timelock.executor)}
      ${metricCard("Min delay", `${formatSeconds(timelock.minDelay)}`)}
    </div>
  `;
}

function renderHistory(history) {
  if (history.entries.length === 0) {
    historyPanel.innerHTML = emptyState(
      `No supported activity was found in the most recent ${history.lookbackBlocks} blocks.`,
    );
    return;
  }

  historyPanel.innerHTML = `
    <div class="history-summary">
      <span>Showing ${history.entries.length} recent items</span>
      <span>Window: last ${history.lookbackBlocks} blocks</span>
      <span>Latest block: ${history.latestBlockNumber}</span>
    </div>
    <div class="history-feed">
      ${history.entries.map((entry) => `
        <article class="history-item">
          <div class="history-head">
            <span class="history-pill" data-category="${escapeHtml(entry.category)}">
              ${escapeHtml(historyCategoryLabel(entry.category))}
            </span>
            <span class="history-meta">
              ${escapeHtml(formatHistoryMoment(entry.timestamp))} · block ${entry.blockNumber}
            </span>
          </div>
          <strong class="history-title">${escapeHtml(entry.title)}</strong>
          <p class="history-detail">${escapeHtml(entry.detail)}</p>
          <div class="history-foot">
            <span>${entry.amount === undefined ? "State transition" : formatEth(entry.amount)}</span>
            <code>${escapeHtml(shortenTxHash(entry.txHash))}</code>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderNotes(config, state) {
  notePanel.innerHTML = `
    <ul class="notes-list">
      <li>Tracked buckets and distributions come from the configured ids because the current contracts do not enumerate them on-chain yet.</li>
      <li>The built-in defaults match a fresh local run of <code>npm run seed:demo:ui</code> against a new <code>hardhat node</code> instance.</li>
      <li>Native asset reads use ${escapeHtml(getNativeAssetAddress())} as the configured ETH sentinel address.</li>
      <li>The dashboard can now fund treasury custody and claim a tracked funded distribution, but governance-owned treasury and distributor policy actions remain read-only here.</li>
      <li>The activity feed is built from recent direct contract logs over the configured address set, without a separate indexing backend.</li>
      <li>There is no dedicated bucket creation event today, so budget allocation is the first bucket lifecycle step visible in the feed.</li>
      <li>Current dashboard chain: ${escapeHtml(chainLabel(state.rpcChainId))}</li>
      <li>Configured buckets: ${escapeHtml(config.trackedBuckets.map((bucket) => bucket.label).join(", "))}</li>
      <li>Configured distributions: ${escapeHtml(config.trackedDistributions.map((distribution) => distribution.label).join(", "))}</li>
    </ul>
  `;
}

function renderWalletPanel() {
  const rpcChainId = latestState?.rpcChainId ?? null;
  const walletChainMatches = rpcChainId !== null && walletState.chainId !== null
    ? normalizeChainId(rpcChainId) === normalizeChainId(walletState.chainId)
    : false;

  walletPanel.innerHTML = `
    <div class="panel-grid compact">
      ${metricCard("Provider", walletState.available ? "Detected" : "Not found")}
      ${metricCard("Account", walletState.account === null ? "Not connected" : shortenAddress(walletState.account))}
      ${metricCard("Wallet chain", chainLabel(walletState.chainId))}
      ${metricCard("Dashboard chain", chainLabel(rpcChainId))}
    </div>
    <p class="wallet-note">
      ${walletExplanation(walletChainMatches)}
    </p>
  `;

  const canUseWallet = walletState.available && walletState.account !== null && walletChainMatches;
  fundTreasuryButton.disabled = !canUseWallet;
  claimDistributionButton.disabled = !canUseWallet || !hasClaimableDistribution();
  switchWalletNetworkButton.disabled = !walletState.available || rpcChainId === null;
}

function hydrateClaimSelector(config, state) {
  claimDistributionSelect.innerHTML = config.trackedDistributions.map((distribution) => {
    const liveDistribution = state.distributor.distributions.find(
      (item) => item.id === distribution.id,
    );
    const statusLabel = liveDistribution?.status === "loaded"
      ? distributionStatus(liveDistribution.stateCode)
      : "Unavailable";

    return `
      <option value="${escapeHtml(distribution.id)}">
        ${escapeHtml(distribution.label)} (${statusLabel})
      </option>
    `;
  }).join("");
}

function renderClaimPreview() {
  const distribution = latestState?.distributor.distributions.find(
    (item) => item.id === claimDistributionSelect.value,
  );

  if (distribution === undefined || distribution.status !== "loaded") {
    claimPreview.innerHTML = "Select a tracked distribution to preview its claim state.";
    claimDistributionButton.disabled = true;
    return;
  }

  const remaining = distribution.fundedAmount - distribution.claimedAmount;
  const canClaim = walletState.account !== null && distribution.stateCode === 1 && remaining > 0n;

  claimPreview.innerHTML = `
    <strong>${escapeHtml(distribution.label)}</strong>
    <span>Remaining claimable amount: ${formatEth(remaining)}</span>
    <span>Status: ${distributionStatus(distribution.stateCode)}</span>
  `;

  const walletReady = walletState.available &&
    walletState.account !== null &&
    latestState?.rpcChainId !== undefined &&
    normalizeChainId(latestState.rpcChainId) === normalizeChainId(walletState.chainId);

  claimDistributionButton.disabled = !(walletReady && canClaim);
}

function clearPanels() {
  summaryPanel.innerHTML = "";
  treasuryPanel.innerHTML = "";
  bucketsPanel.innerHTML = "";
  distributorPanel.innerHTML = "";
  rolesPanel.innerHTML = "";
  timelockPanel.innerHTML = "";
  historyPanel.innerHTML = "";
  notePanel.innerHTML = "";
}

function setStatus(message, tone) {
  statusBanner.textContent = message;
  statusBanner.dataset.tone = tone;
}

function setWriteStatus(message, tone) {
  writeStatusBanner.textContent = message;
  writeStatusBanner.dataset.tone = tone;
}

function setDeployerStatus(message, tone) {
  deployerStatusBanner.textContent = message;
  deployerStatusBanner.dataset.tone = tone;
}

function loadStoredDeployerConfig() {
  const raw = window.localStorage.getItem(DEPLOYER_STORAGE_KEY);

  if (raw === null) {
    return structuredClone(deployerDefaults);
  }

  try {
    return {
      ...structuredClone(deployerDefaults),
      ...JSON.parse(raw),
    };
  } catch {
    return structuredClone(deployerDefaults);
  }
}

function storeDeployerConfig(config) {
  window.localStorage.setItem(DEPLOYER_STORAGE_KEY, JSON.stringify(config));
}

function loadGuidedDemoStepIndex() {
  const raw = window.localStorage.getItem(GUIDED_DEMO_STORAGE_KEY);
  const index = Number(raw);

  if (!Number.isInteger(index) || index < 0 || index >= GUIDED_DEMO_STEPS.length) {
    return 0;
  }

  return index;
}

function storeGuidedDemoStepIndex(index) {
  window.localStorage.setItem(GUIDED_DEMO_STORAGE_KEY, String(index));
}

function hydrateDeployerForm(config) {
  deployerForm.networkProfile.innerHTML = Object.entries(deploymentProfiles)
    .map(([value, profile]) => `
      <option value="${escapeHtml(value)}">${escapeHtml(profile.label)}</option>
    `)
    .join("");

  deployerForm.systemLabel.value = config.systemLabel;
  deployerForm.networkProfile.value = config.networkProfile;
  deployerForm.tokenName.value = config.tokenName;
  deployerForm.tokenSymbol.value = config.tokenSymbol;
  deployerForm.initialSupplyTokens.value = config.initialSupplyTokens;
  deployerForm.governorName.value = config.governorName;
  deployerForm.timelockDelayHours.value = config.timelockDelayHours;
  deployerForm.selfDelegateInitialVotes.value = String(config.selfDelegateInitialVotes);
  deployerForm.selfAdminAfterBootstrap.value = String(config.selfAdminAfterBootstrap);
}

function readDeployerFormConfig() {
  return {
    systemLabel: requireText(deployerForm.systemLabel.value, "System label"),
    networkProfile: deployerForm.networkProfile.value.trim(),
    tokenName: requireText(deployerForm.tokenName.value, "Token name"),
    tokenSymbol: requireSymbol(deployerForm.tokenSymbol.value),
    initialSupplyTokens: requireWholeNumber(
      deployerForm.initialSupplyTokens.value,
      "Initial token supply",
    ),
    governorName: requireText(deployerForm.governorName.value, "Governor name"),
    timelockDelayHours: requirePositiveNumber(
      deployerForm.timelockDelayHours.value,
      "Timelock delay",
    ),
    selfDelegateInitialVotes: deployerForm.selfDelegateInitialVotes.value === "true",
    selfAdminAfterBootstrap: deployerForm.selfAdminAfterBootstrap.value === "true",
  };
}

function buildLaunchPlan(config) {
  const profile = deploymentProfiles[config.networkProfile] ?? deploymentProfiles.localhost;
  const recommended = profile.recommended;
  const timelockDelaySeconds = decimalHoursToSeconds(config.timelockDelayHours);
  const initialSupplyBaseUnits = (BigInt(config.initialSupplyTokens) * 10n ** 18n).toString();

  return {
    systemLabel: config.systemLabel,
    profile,
    command: profile.command,
    envVars: profile.requiredEnvVars,
    envExample: buildEnvExample(profile.requiredEnvVars),
    modules: deploymentBlueprint,
    handoffSteps: [
      "Deploy GovernanceToken, Treasury, Distributor, GovernanceTimelock, and GovernanceGovernor in one explicit script run.",
      "Bootstrap the deployer as the temporary owner and timelock admin during initialization.",
      config.selfDelegateInitialVotes
        ? "Self-delegate the initial governance supply to the bootstrap deployer so the first proposal path is usable."
        : "Skip bootstrap vote self-delegation and leave initial voting power undelegated.",
      "Update timelock proposer and executor to the deployed governor contract.",
      "Transfer GovernanceToken, Treasury, and Distributor ownership to the timelock.",
      config.selfAdminAfterBootstrap
        ? "Transfer timelock admin to the timelock itself to complete the ownership handoff."
        : "Retain timelock admin at the bootstrap deployer for manual follow-up administration.",
    ],
    configPreview: {
      network: {
        name: profile.networkName,
        label: profile.label,
        requiredEnvVars: profile.requiredEnvVars,
      },
      token: {
        name: config.tokenName,
        symbol: config.tokenSymbol,
        initialSupply: initialSupplyBaseUnits,
        selfDelegateInitialVotes: config.selfDelegateInitialVotes,
      },
      timelock: {
        minDelay: timelockDelaySeconds.toString(),
        selfAdminAfterBootstrap: config.selfAdminAfterBootstrap,
      },
      governor: {
        name: config.governorName,
        votingDelay: recommended.votingDelayBlocks,
        votingPeriod: recommended.votingPeriodBlocks,
        proposalThreshold: recommended.proposalThresholdTokens,
        quorumNumeratorBps: recommended.quorumNumeratorBps,
      },
    },
    notes: profile.notes,
  };
}

function loadStoredConfig() {
  const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);

  if (raw === null) {
    return structuredClone(demoDefaults);
  }

  try {
    return {
      ...structuredClone(demoDefaults),
      ...JSON.parse(raw),
    };
  } catch {
    return structuredClone(demoDefaults);
  }
}

function storeConfig(config) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function hydrateForm(config) {
  form.rpcUrl.value = config.rpcUrl;
  form.governanceToken.value = config.addresses.governanceToken;
  form.treasury.value = config.addresses.treasury;
  form.distributor.value = config.addresses.distributor;
  form.governanceTimelock.value = config.addresses.governanceTimelock;
  form.governanceGovernor.value = config.addresses.governanceGovernor;
  form.trackedBuckets.value = config.trackedBuckets
    .map((bucket) => `${bucket.label}|${bucket.id}`)
    .join("\n");
  form.trackedDistributions.value = config.trackedDistributions
    .map((distribution) => `${distribution.label}|${distribution.id}`)
    .join("\n");
}

function readFormConfig() {
  return {
    rpcUrl: form.rpcUrl.value.trim(),
    addresses: {
      governanceToken: form.governanceToken.value.trim(),
      treasury: form.treasury.value.trim(),
      distributor: form.distributor.value.trim(),
      governanceTimelock: form.governanceTimelock.value.trim(),
      governanceGovernor: form.governanceGovernor.value.trim(),
    },
    trackedBuckets: parseTrackedItems(form.trackedBuckets.value),
    trackedDistributions: parseTrackedItems(form.trackedDistributions.value),
    history: latestConfig?.history ?? structuredClone(demoDefaults.history),
  };
}

function parseTrackedItems(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, id] = line.split("|");

      return {
        label: (label ?? "").trim() || "Tracked item",
        id: (id ?? "").trim(),
      };
    });
}

function metricCard(label, value) {
  return `
    <div class="stat-card">
      <span class="eyebrow">${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function distributionStatus(code) {
  if (code === 0) {
    return "None";
  }
  if (code === 1) {
    return "Funded";
  }
  if (code === 2) {
    return "Closed";
  }

  return `Unknown (${code})`;
}

function formatEth(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0");
  const trimmedFraction = fraction.replace(/0+$/, "").slice(0, 4);

  return trimmedFraction.length === 0
    ? `${whole.toString()} ETH`
    : `${whole.toString()}.${trimmedFraction} ETH`;
}

function formatSeconds(value) {
  const seconds = Number(value);
  const hours = Math.floor(seconds / 3600);

  if (hours > 0 && seconds % 3600 === 0) {
    return `${hours}h`;
  }

  return `${seconds}s`;
}

function formatTokenCount(baseUnitValue) {
  return formatEth(BigInt(baseUnitValue)).replace(" ETH", "");
}

function deriveRoleView(state) {
  const timelockAddress = lower(state.addresses.governanceTimelock);
  const governorAddress = lower(state.addresses.governanceGovernor);
  const tokenOwner = lower(state.governance.tokenOwner);
  const treasuryOwner = lower(state.treasury.owner);
  const distributorOwner = lower(state.distributor.owner);
  const timelockAdmin = lower(state.timelock.admin);
  const timelockProposer = lower(state.timelock.proposer);
  const timelockExecutor = lower(state.timelock.executor);

  const tokenHandedOff = tokenOwner === timelockAddress;
  const treasuryHandedOff = treasuryOwner === timelockAddress;
  const distributorHandedOff = distributorOwner === timelockAddress;
  const proposerHandedOff = timelockProposer === governorAddress;
  const executorHandedOff = timelockExecutor === governorAddress;
  const adminSelfManaged = timelockAdmin === timelockAddress;

  const fullyHandedOff = tokenHandedOff &&
    treasuryHandedOff &&
    distributorHandedOff &&
    proposerHandedOff &&
    executorHandedOff;

  const bootstrapMode = !fullyHandedOff || !adminSelfManaged;

  return {
    modeLabel: bootstrapMode ? "Bootstrap or partial handoff" : "Governance handoff complete",
    modeTone: bootstrapMode ? "warning" : "success",
    modeDetail: bootstrapMode
      ? "One or more core modules or timelock roles are still outside the final steady-state governance posture."
      : "Core module ownership and timelock relationships line up with the intended governed operating model.",
    pathLabel: "Governor -> Timelock -> Modules",
    pathTone: proposerHandedOff && executorHandedOff ? "success" : "warning",
    pathDetail: proposerHandedOff && executorHandedOff
      ? "The governor is positioned to propose and execute through the timelock, and the timelock is the expected control boundary."
      : "The timelock does not yet appear fully wired to the governor for both proposal queueing and execution.",
    rows: [
      buildRoleRow({
        label: "Governance token",
        controller: state.governance.tokenOwner,
        expected: "Timelock owns the token after bootstrap handoff.",
        isExpected: tokenHandedOff,
        copy: tokenHandedOff
          ? "Token ownership has moved under the timelock boundary."
          : "Token ownership is still outside the timelock boundary.",
      }),
      buildRoleRow({
        label: "Treasury",
        controller: state.treasury.owner,
        expected: "Timelock owns treasury policy actions.",
        isExpected: treasuryHandedOff,
        copy: treasuryHandedOff
          ? "Treasury actions should route through governance and the timelock."
          : "Treasury still appears directly controlled outside the intended timelock path.",
      }),
      buildRoleRow({
        label: "Distributor",
        controller: state.distributor.owner,
        expected: "Timelock owns distribution configuration and funding.",
        isExpected: distributorHandedOff,
        copy: distributorHandedOff
          ? "Distribution setup is positioned behind governance control."
          : "Distributor ownership is still outside the intended timelock path.",
      }),
      buildRoleRow({
        label: "Timelock admin",
        controller: state.timelock.admin,
        expected: "Timelock self-admin or clearly governed admin posture.",
        isExpected: adminSelfManaged,
        copy: adminSelfManaged
          ? "The timelock appears self-administered, which matches the post-bootstrap sealed posture."
          : "The timelock admin is still external, which usually indicates bootstrap mode or an intentionally retained operator.",
      }),
      buildRoleRow({
        label: "Timelock proposer",
        controller: state.timelock.proposer,
        expected: "Governor is the proposer that queues governance actions.",
        isExpected: proposerHandedOff,
        copy: proposerHandedOff
          ? "The governor is in the proposer seat for timelocked actions."
          : "Proposal queueing authority is not currently aligned with the configured governor.",
      }),
      buildRoleRow({
        label: "Timelock executor",
        controller: state.timelock.executor,
        expected: "Governor is the executor for approved timelocked actions.",
        isExpected: executorHandedOff,
        copy: executorHandedOff
          ? "The governor is in the executor seat for approved timelocked actions."
          : "Execution authority is not currently aligned with the configured governor.",
      }),
    ],
  };
}

function buildRoleRow({ label, controller, expected, isExpected, copy }) {
  return {
    label,
    controller,
    expected,
    copy,
    tone: isExpected ? "success" : "warning",
    status: isExpected ? "Aligned" : "Check",
  };
}

function formatHistoryMoment(timestamp) {
  if (timestamp === null || timestamp === undefined) {
    return "Unknown time";
  }

  return new Date(timestamp * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function emptyState(message) {
  return `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function historyCategoryLabel(category) {
  if (category === "treasury") {
    return "Treasury";
  }
  if (category === "distribution") {
    return "Distributor";
  }
  if (category === "governance") {
    return "Governance";
  }

  return "Activity";
}

function walletExplanation(walletChainMatches) {
  if (!walletState.available) {
    return "No injected wallet provider was found. Open this dashboard in a browser with MetaMask or another EIP-1193 wallet.";
  }
  if (walletState.account === null) {
    return "Connect a wallet to fund treasury custody or claim a tracked distribution.";
  }
  if (!walletChainMatches) {
    return "Your wallet is connected, but it is not currently on the same chain as the dashboard RPC. Use the switch button before sending a transaction.";
  }

  return "The connected wallet is ready for the small set of MVP actions exposed in this dashboard.";
}

function hasClaimableDistribution() {
  return latestState?.distributor.distributions.some((distribution) => {
    if (distribution.status !== "loaded") {
      return false;
    }

    return distribution.stateCode === 1 &&
      distribution.fundedAmount - distribution.claimedAmount > 0n;
  }) ?? false;
}

function requireState() {
  if (latestState === null) {
    throw new Error("Refresh the dashboard state before sending an action.");
  }

  return latestState;
}

function requireConfig() {
  if (latestConfig === null) {
    throw new Error("Refresh the dashboard config before sending an action.");
  }

  return latestConfig;
}

function requireRpcChainId() {
  const state = requireState();

  if (state.rpcChainId === null || state.rpcChainId === undefined) {
    throw new Error("Could not determine the dashboard RPC chain id.");
  }

  return state.rpcChainId;
}

async function handleCopyLaunchCommand() {
  try {
    if (latestLaunchPlan === null) {
      throw new Error("Generate a launch plan before copying the deploy command.");
    }

    await copyText(latestLaunchPlan.command);
    setDeployerStatus("Deploy command copied.", "success");
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  }
}

async function handleCopyLaunchConfig() {
  try {
    if (latestLaunchPlan === null) {
      throw new Error("Generate a launch plan before copying the launch config.");
    }

    await copyText(JSON.stringify(latestLaunchPlan.configPreview, null, 2));
    setDeployerStatus("Launch config preview copied.", "success");
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  }
}

async function copyText(value) {
  if (!("clipboard" in navigator) || typeof navigator.clipboard.writeText !== "function") {
    throw new Error("Clipboard copying is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

function normalizeChainId(chainId) {
  if (chainId === null || chainId === undefined) {
    return "";
  }

  return chainId.toLowerCase();
}

function shortenTxHash(txHash) {
  if (txHash === undefined || txHash === null || txHash.length < 14) {
    return "unknown tx";
  }

  return `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
}

function lower(value) {
  return (value ?? "").toLowerCase();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function requireText(value, label) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function requireSymbol(value) {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z0-9]{2,10}$/.test(normalized)) {
    throw new Error("Token symbol must be 2-10 uppercase letters or numbers.");
  }

  return normalized;
}

function requireWholeNumber(value, label) {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }

  return normalized;
}

function requirePositiveNumber(value, label) {
  const normalized = value.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return normalized;
}

function decimalHoursToSeconds(value) {
  const [wholePart, fractionPart = ""] = value.split(".");
  const wholeSeconds = BigInt(wholePart || "0") * 3600n;
  const fractionDigits = (fractionPart + "0".repeat(3)).slice(0, 3);
  const fractionSeconds = (BigInt(fractionDigits || "0") * 3600n) / 1000n;

  return wholeSeconds + fractionSeconds;
}

function buildEnvExample(envVars) {
  if (envVars.length === 0) {
    return "# No extra environment values are required for this launch profile.";
  }

  return envVars
    .map((name) => `$env:${name}=\"replace-me\"`)
    .join("\n");
}
