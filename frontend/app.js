import { demoDefaults } from "./demo-config.js";
import {
  deployerDefaults,
  deploymentBlueprint,
  deploymentProfiles,
} from "./deployer-config.js";
import { getNativeAssetAddress, loadDashboardState, readTokenVotes } from "./rpc.js";
import {
  chainLabel,
  createGovernanceProposal,
  castGovernanceVote,
  queueGovernanceProposal,
  executeGovernanceProposal,
  encodeTreasuryClassifyCapital,
  encodeTreasuryAllocateBudget,
  encodeTreasurySpend,
  encodeDistributorCreateDistribution,
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
const healthPanel = document.querySelector("#health-panel");
const summaryPanel = document.querySelector("#summary-panel");
const treasuryPanel = document.querySelector("#treasury-panel");
const bucketsPanel = document.querySelector("#buckets-panel");
const distributorPanel = document.querySelector("#distributor-panel");
const rolesPanel = document.querySelector("#roles-panel");
const governancePanel = document.querySelector("#governance-panel");
const timelockPanel = document.querySelector("#timelock-panel");
const historyPanel = document.querySelector("#history-panel");
const notePanel = document.querySelector("#note-panel");
const walletPanel = document.querySelector("#wallet-panel");
const resetButton = document.querySelector("#reset-defaults");
const connectWalletButton = document.querySelector("#connect-wallet");
const switchWalletNetworkButton = document.querySelector("#switch-wallet-network");
const fundTreasuryForm = document.querySelector("#fund-treasury-form");
const treasuryGovernanceForm = document.querySelector("#treasury-governance-form");
const treasuryActionPreview = document.querySelector("#treasury-action-preview");
const claimDistributionForm = document.querySelector("#claim-distribution-form");
const claimDistributionSelect = document.querySelector("#claim-distribution-select");
const claimPreview = document.querySelector("#claim-preview");
const fundTreasuryButton = document.querySelector("#fund-treasury-button");
const treasuryGovernanceButton = document.querySelector("#treasury-governance-button");
const claimDistributionButton = document.querySelector("#claim-distribution-button");

let latestState = null;
let latestConfig = null;
let latestLaunchPlan = null;
let guidedDemoStepIndex = loadGuidedDemoStepIndex();
let latestWalletVotes = 0n;
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
  latestWalletVotes = await refreshWalletVotes(config);

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

  treasuryGovernanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleTreasuryGovernanceAction();
  });

  treasuryGovernanceForm.actionKey.addEventListener("change", () => {
    renderTreasuryActionForm(latestState);
  });
  treasuryGovernanceForm.bucketId.addEventListener("change", () => {
    renderTreasuryActionForm(latestState);
  });
  treasuryGovernanceForm.amountEth.addEventListener("input", () => {
    renderTreasuryActionForm(latestState);
  });
  treasuryGovernanceForm.recipient.addEventListener("input", () => {
    renderTreasuryActionForm(latestState);
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
    latestWalletVotes = await refreshWalletVotes(latestConfig);
    renderWalletPanel();
    renderTreasuryActionForm(latestState);
    renderGovernance(latestState);
    renderClaimPreview();
  });

  renderWalletPanel();
  renderTreasuryActionForm(latestState);
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
    hydrateClaimSelector(config, state);
    renderHealth(state);
    renderSummary(config, state);
    renderTreasury(state.treasury);
    renderBuckets(state.treasury.buckets);
    renderDistributor(state.distributor);
    renderRoles(state);
    renderGovernance(state);
    renderTimelock(state.timelock);
    renderHistory(state.history);
    renderNotes(config, state);
    renderWalletPanel();
    renderTreasuryActionForm(state);
    renderClaimPreview();
    setStatus("Dashboard updated from the current chain state.", "success");
  } catch (error) {
    latestState = null;
    clearPanels();
    renderHealth(null);
    renderWalletPanel();
    renderTreasuryActionForm(null);
    renderGovernance(null);
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
    latestWalletVotes = await refreshWalletVotes(latestConfig);
    renderWalletPanel();
    renderGovernance(latestState);
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
    latestWalletVotes = await refreshWalletVotes(config);
    renderWalletPanel();
    renderGovernance(latestState);
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

async function handleTreasuryGovernanceAction() {
  try {
    const state = requireState();
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();
    const draft = buildTreasuryActionDraft(state);

    setWriteStatus("Preparing treasury governance proposal.", "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await createGovernanceProposal({
      governorAddress: config.addresses.governanceGovernor,
      target: config.addresses.treasury,
      value: 0n,
      data: draft.data,
      description: draft.description,
    });

    setWriteStatus(`Treasury proposal submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    latestWalletVotes = await refreshWalletVotes(config);
    await refresh();
    setWriteStatus(
      "Treasury proposal created. The treasury state will change only after voting, queueing, and execution complete.",
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

function renderHealth(state) {
  if (state === null) {
    healthPanel.innerHTML = emptyState("Refresh the dashboard to load a compact system health view.");
    return;
  }

  const healthView = deriveHealthView(state);

  healthPanel.innerHTML = `
    <div class="roles-overview">
      <div class="role-status-card" data-mode="${escapeHtml(healthView.readinessTone)}">
        <span class="eyebrow">Overall status</span>
        <strong>${escapeHtml(healthView.readinessLabel)}</strong>
        <p>${escapeHtml(healthView.readinessDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(healthView.controlTone)}">
        <span class="eyebrow">Control posture</span>
        <strong>${escapeHtml(healthView.controlLabel)}</strong>
        <p>${escapeHtml(healthView.controlDetail)}</p>
      </div>
    </div>
    <div class="panel-grid compact">
      ${metricCard("Addresses loaded", `${healthView.addressesLoaded} / ${healthView.addressesExpected}`)}
      ${metricCard("Treasury custody", formatEth(state.treasury.totalBalance))}
      ${metricCard("Distributor outstanding", formatEth(state.distributor.totalOutstanding))}
      ${metricCard("Active distributions", healthView.activeDistributionCount)}
      ${metricCard("Tracked buckets loaded", `${healthView.loadedBucketCount} / ${healthView.totalBucketCount}`)}
      ${metricCard("Governance proposals", healthView.proposalCount)}
    </div>
    <div class="actions-layout health-layout">
      <div class="action-card">
        <h3>Attention flags</h3>
        ${healthView.warnings.length === 0
          ? `<p class="action-copy">${escapeHtml(healthView.clearMessage)}</p>`
          : `
            <ul class="notes-list">
              ${healthView.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
            </ul>
          `}
      </div>
      <div class="action-card">
        <h3>How to interpret this</h3>
        <ul class="notes-list">
          ${healthView.interpretation.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
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
                <div class="button-row compact-row">
                  <button
                    type="button"
                    class="ghost-button"
                    data-bucket-action="use"
                    data-bucket-id="${bucket.id}"
                  >
                    Use in treasury form
                  </button>
                </div>
              </span>
              <span>${formatEth(bucket.allocated)}</span>
              <span>${formatEth(bucket.spent)}</span>
              <span>${formatEth(bucket.remaining)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;

  bucketsPanel.querySelectorAll("[data-bucket-action='use']").forEach((button) => {
    button.addEventListener("click", () => {
      treasuryGovernanceForm.bucketId.value = button.dataset.bucketId ?? "";
      renderTreasuryActionForm(latestState);
      document.querySelector("#wallet-actions-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
}

function renderDistributor(distributor) {
  const activeCount = distributor.distributions.filter((distribution) =>
    distribution.status === "loaded" && distribution.stateCode === 1
  ).length;

  distributorPanel.innerHTML = `
    <div class="panel-grid compact">
      ${metricCard("Owner", distributor.owner)}
      ${metricCard("Total outstanding", formatEth(distributor.totalOutstanding))}
      ${metricCard("Active events", activeCount)}
    </div>
    <div class="distribution-feed">
      ${distributor.distributions.map((distribution) => {
        if (distribution.status === "error") {
          return `
            <article class="distribution-card error-row">
              <div>
                <strong>${escapeHtml(distribution.label)}</strong>
                <code>${escapeHtml(distribution.id)}</code>
              </div>
              <p class="distribution-note">${escapeHtml(distribution.error)}</p>
            </article>
          `;
        }

        const remaining = distribution.fundedAmount - distribution.claimedAmount;
        const claimView = describeDistributionClaimState(distribution);
        const isSelected = claimDistributionSelect.value === distribution.id;

        return `
          <article class="distribution-card">
            <div class="distribution-card-head">
              <div>
                <strong>${escapeHtml(distribution.label)}</strong>
                <code>${escapeHtml(distribution.id)}</code>
              </div>
              <span class="role-badge" data-tone="${escapeHtml(claimView.tone)}">
                ${escapeHtml(distributionStatus(distribution.stateCode))}
              </span>
            </div>
            <div class="panel-grid compact distribution-metrics">
              ${metricCard("Asset", distributionAssetLabel(distribution.asset))}
              ${metricCard("Total event amount", formatEth(distribution.totalAmount))}
              ${metricCard("Funded", formatEth(distribution.fundedAmount))}
              ${metricCard("Claimed", formatEth(distribution.claimedAmount))}
              ${metricCard("Remaining", formatEth(remaining))}
            </div>
            <p class="distribution-note">${escapeHtml(claimView.detail)}</p>
            <div class="button-row compact-row">
              <button
                type="button"
                class="ghost-button"
                data-distribution-action="select"
                data-distribution-id="${distribution.id}"
              >
                ${isSelected ? "Selected in claim flow" : "Use in claim flow"}
              </button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
    <p class="action-note">
      Current claim behavior is intentionally simple: each recipient can self-claim once,
      and the current demo flow claims the full remaining amount for the selected event.
    </p>
  `;

  distributorPanel.querySelectorAll("[data-distribution-action='select']").forEach((button) => {
    button.addEventListener("click", () => {
      claimDistributionSelect.value = button.dataset.distributionId ?? "";
      if (latestState !== null) {
        renderDistributor(latestState.distributor);
      }
      renderClaimPreview();
      document.querySelector("#wallet-actions-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
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

function renderGovernance(state) {
  if (state === null) {
    governancePanel.innerHTML = emptyState("Refresh the dashboard to load governance proposals.");
    return;
  }

  const governance = state.governance;
  const walletReady = walletState.available &&
    walletState.account !== null &&
    normalizeChainId(state.rpcChainId) === normalizeChainId(walletState.chainId);
  const composerOptions = governanceComposerOptions(state);

  governancePanel.innerHTML = `
    <div class="roles-overview">
      <div class="role-status-card" data-mode="success">
        <span class="eyebrow">Proposal threshold</span>
        <strong>${formatEth(governance.proposalThreshold)}</strong>
        <p>The connected proposer needs at least this much delegated voting power to create a proposal.</p>
      </div>
      <div class="role-status-card" data-mode="${latestWalletVotes >= governance.proposalThreshold ? "success" : "warning"}">
        <span class="eyebrow">Connected wallet votes</span>
        <strong>${walletState.account === null ? "Not connected" : formatEth(latestWalletVotes)}</strong>
        <p>${walletReady
          ? latestWalletVotes >= governance.proposalThreshold
            ? "This wallet appears to have enough delegated votes to create a proposal."
            : "This wallet can still read and vote, but it does not appear to meet the current proposal threshold."
          : "Connect a wallet on the same chain to create or advance proposals."}</p>
      </div>
      <div class="role-status-card" data-mode="success">
        <span class="eyebrow">Voting window</span>
        <strong>${governance.votingDelay.toString()} delay / ${governance.votingPeriod.toString()} period</strong>
        <p>Proposals wait through the voting delay, then remain open for the voting period before queueing and execution.</p>
      </div>
      <div class="role-status-card" data-mode="success">
        <span class="eyebrow">Timelock delay</span>
        <strong>${formatSeconds(governance.timelockMinDelay)}</strong>
        <p>Succeeded proposals still wait through this timelock delay after queueing before execution becomes ready.</p>
      </div>
    </div>
    <div class="actions-layout">
      <div class="action-card">
        <h3>Create Proposal</h3>
        <p class="action-copy">
          This MVP composer supports a very small set of real single-action proposals
          that match the current governor contract.
        </p>
        <form id="governance-proposal-form" class="action-form">
          <label>
            <span>Action template</span>
            <select name="actionKey">
              ${composerOptions.map((option) => `
                <option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Amount (ETH)</span>
            <input name="amountEth" type="text" value="${composerOptions[0]?.defaultAmountEth ?? "1"}" inputmode="decimal" />
          </label>
          <label>
            <span>Description</span>
            <input name="description" type="text" value="${escapeHtml(composerOptions[0]?.defaultDescription ?? "")}" />
          </label>
          <div id="governance-proposal-preview" class="action-preview"></div>
          <button id="create-governance-proposal" type="submit" ${walletReady ? "" : "disabled"}>
            Submit proposal
          </button>
        </form>
      </div>
      <div class="action-card">
        <h3>What This Can Do</h3>
        <ul class="notes-list compact-list">
          <li>Read proposal status, vote totals, and the intended action description.</li>
          <li>Create a small set of single-action proposals when the connected wallet has enough delegated votes.</li>
          <li>Vote, queue, and execute proposals when their state allows it.</li>
          <li>Stay aligned with the real governor to timelock flow instead of faking a broader governance portal.</li>
        </ul>
      </div>
    </div>
    <div class="history-summary governance-summary">
      <span>Total proposals: ${governance.proposalCount.toString()}</span>
      <span>Quorum numerator: ${governance.quorumNumeratorBps.toString()} bps</span>
      <span>Governor address: ${escapeHtml(shortenAddress(governance.governorAddress))}</span>
    </div>
    ${governance.proposals.length === 0 ? emptyState("No proposals have been created on this deployment yet.") : `
      <div class="history-feed">
        ${governance.proposals.map((proposal) => {
          const lifecycle = describeProposalLifecycle(proposal, governance, walletReady);

          return `
          <article class="history-item proposal-card" data-tone="${escapeHtml(lifecycle.tone)}">
            <div class="history-head">
              <span class="history-pill" data-category="governance">
                Proposal #${proposal.proposalId}
              </span>
              <span class="role-badge" data-tone="${escapeHtml(lifecycle.tone)}">${escapeHtml(lifecycle.label)}</span>
            </div>
            <strong class="history-title">${escapeHtml(proposal.description || `Single-action proposal #${proposal.proposalId}`)}</strong>
            <p class="history-detail">
              Target ${escapeHtml(proposalTargetLabel(proposal.target, state))} (${escapeHtml(shortenAddress(proposal.target))}) - proposer ${escapeHtml(shortenAddress(proposal.proposer))}
            </p>
            <p class="proposal-lifecycle-note">${escapeHtml(lifecycle.detail)}</p>
            <div class="proposal-vote-grid">
              ${metricCard("For", formatEth(proposal.forVotes))}
              ${metricCard("Against", formatEth(proposal.againstVotes))}
              ${metricCard("Abstain", formatEth(proposal.abstainVotes))}
              ${metricCard("Created", formatOptionalMoment(proposal.createdTimestamp))}
              ${metricCard("Voting starts", `Block ${proposal.snapshot.toString()}`)}
              ${metricCard("Voting ends", `Block ${proposal.deadline.toString()}`)}
              ${metricCard("Queued at", formatOptionalMoment(proposal.queuedTimestamp))}
              ${metricCard("Earliest execution", formatOptionalMoment(proposal.earliestExecutionTimestamp))}
              ${metricCard("Call value", formatEth(proposal.value))}
            </div>
            <div class="button-row compact-row">
              <button type="button" class="ghost-button" data-proposal-action="vote" data-support="1" data-proposal-id="${proposal.proposalId}" ${lifecycle.canVote ? "" : "disabled"}>Vote for</button>
              <button type="button" class="ghost-button" data-proposal-action="vote" data-support="0" data-proposal-id="${proposal.proposalId}" ${lifecycle.canVote ? "" : "disabled"}>Vote against</button>
              <button type="button" class="ghost-button" data-proposal-action="vote" data-support="2" data-proposal-id="${proposal.proposalId}" ${lifecycle.canVote ? "" : "disabled"}>Abstain</button>
              <button type="button" class="ghost-button" data-proposal-action="queue" data-proposal-id="${proposal.proposalId}" ${lifecycle.canQueue ? "" : "disabled"}>Queue</button>
              <button type="button" class="ghost-button" data-proposal-action="execute" data-proposal-id="${proposal.proposalId}" ${lifecycle.canExecute ? "" : "disabled"}>Execute</button>
            </div>
            <p class="proposal-action-note">${escapeHtml(lifecycle.actionDetail)}</p>
          </article>
        `;
        }).join("")}
      </div>
    `}
  `;

  const proposalForm = document.querySelector("#governance-proposal-form");
  const actionSelect = proposalForm?.actionKey;
  if (proposalForm !== null) {
    updateGovernanceProposalPreview(state);
    proposalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleCreateGovernanceProposal();
    });
    actionSelect?.addEventListener("change", () => {
      const selected = composerOptions.find((option) => option.key === actionSelect.value);
      if (selected !== undefined) {
        proposalForm.amountEth.value = selected.defaultAmountEth;
        proposalForm.description.value = selected.defaultDescription;
      }
      updateGovernanceProposalPreview(state);
    });
    proposalForm.amountEth.addEventListener("input", () => updateGovernanceProposalPreview(state));
    proposalForm.description.addEventListener("input", () => updateGovernanceProposalPreview(state));
  }

  governancePanel.querySelectorAll("[data-proposal-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposalId = Number(button.dataset.proposalId);
      const action = button.dataset.proposalAction;

      if (action === "vote") {
        await handleGovernanceVote(proposalId, Number(button.dataset.support));
        return;
      }
      if (action === "queue") {
        await handleGovernanceQueue(proposalId);
        return;
      }
      if (action === "execute") {
        await handleGovernanceExecute(proposalId);
      }
    });
  });
}

function describeProposalLifecycle(proposal, governance, walletReady) {
  const stateCode = proposal.stateCode;

  if (!walletReady) {
    return {
      tone: proposalStateTone(stateCode),
      label: proposalStateLabel(stateCode),
      canVote: false,
      canQueue: false,
      canExecute: false,
      detail: baseProposalStateDetail(proposal, governance),
      actionDetail: "Connect a wallet on the same chain as the dashboard to vote, queue, or execute proposals.",
    };
  }

  if (stateCode === 0) {
    return {
      tone: "warning",
      label: "Pending",
      canVote: false,
      canQueue: false,
      canExecute: false,
      detail: `Voting has not started yet. This proposal becomes active after block ${proposal.snapshot.toString()}.`,
      actionDetail: "Queueing and execution stay blocked until the proposal finishes voting and succeeds.",
    };
  }
  if (stateCode === 1) {
    return {
      tone: "success",
      label: "Active",
      canVote: true,
      canQueue: false,
      canExecute: false,
      detail: `Voting is live now and ends after block ${proposal.deadline.toString()}.`,
      actionDetail: "Voting is available now. Queueing only becomes available after the proposal succeeds.",
    };
  }
  if (stateCode === 2) {
    return {
      tone: "warning",
      label: "Defeated",
      canVote: false,
      canQueue: false,
      canExecute: false,
      detail: "This proposal did not reach a successful voting outcome, so it cannot move into the timelock queue.",
      actionDetail: "Defeated proposals cannot be queued or executed.",
    };
  }
  if (stateCode === 3) {
    return {
      tone: "success",
      label: "Succeeded",
      canVote: false,
      canQueue: true,
      canExecute: false,
      detail: "This proposal passed voting and is ready to be queued into the timelock.",
      actionDetail: "Queueing is available now. Execution only becomes available after queueing and the timelock delay.",
    };
  }
  if (stateCode === 4) {
    const readyTimestamp = proposal.earliestExecutionTimestamp;
    const isReady = readyTimestamp !== null && governance.currentTimestamp >= readyTimestamp;

    return {
      tone: isReady ? "success" : "warning",
      label: "Queued",
      canVote: false,
      canQueue: false,
      canExecute: isReady,
      detail: proposal.queuedTimestamp === null
        ? "This proposal is queued in the timelock."
        : `This proposal entered the timelock queue at ${formatOptionalMoment(proposal.queuedTimestamp)}.`,
      actionDetail: isReady
        ? "The timelock delay has elapsed, so execution is available now."
        : `Execution is blocked until the timelock delay ends at ${formatOptionalMoment(readyTimestamp)}.`,
    };
  }
  if (stateCode === 5) {
    return {
      tone: "success",
      label: "Executed",
      canVote: false,
      canQueue: false,
      canExecute: false,
      detail: proposal.executedTimestamp === null
        ? "This proposal has already been executed."
        : `This proposal executed at ${formatOptionalMoment(proposal.executedTimestamp)}.`,
      actionDetail: "Executed proposals are complete and cannot be advanced further.",
    };
  }
  if (stateCode === 6) {
    return {
      tone: "warning",
      label: "Canceled",
      canVote: false,
      canQueue: false,
      canExecute: false,
      detail: "This proposal was canceled before completion.",
      actionDetail: "Canceled proposals cannot be voted, queued, or executed.",
    };
  }

  return {
    tone: "warning",
    label: proposalStateLabel(stateCode),
    canVote: false,
    canQueue: false,
    canExecute: false,
    detail: baseProposalStateDetail(proposal, governance),
    actionDetail: "This proposal is in an unknown state.",
  };
}

function baseProposalStateDetail(proposal, governance) {
  if (proposal.stateCode === 4 && proposal.queuedTimestamp !== null) {
    return `Queued at ${formatOptionalMoment(proposal.queuedTimestamp)} with a timelock delay of ${formatSeconds(governance.timelockMinDelay)}.`;
  }

  return `Current lifecycle state: ${proposalStateLabel(proposal.stateCode)}.`;
}

function governanceComposerOptions(state) {
  const bucket = latestConfig?.trackedBuckets[0];
  const distribution = latestConfig?.trackedDistributions[0];

  return [
    {
      key: "classify-operating",
      label: "Classify treasury capital as operating",
      defaultAmountEth: "1",
      defaultDescription: "Classify 1 ETH as operating capital",
      buildDraft(amountWei, description) {
        return {
          target: state.addresses.treasury,
          value: 0n,
          data: encodeTreasuryClassifyCapital({ amountWei }),
          description,
          preview: `Treasury will classify ${formatEth(amountWei)} as operating capital.`,
        };
      },
    },
    {
      key: "allocate-budget",
      label: bucket === undefined
        ? "Allocate operating budget to tracked bucket"
        : `Allocate operating budget to ${bucket.label}`,
      defaultAmountEth: "1",
      defaultDescription: bucket === undefined
        ? "Allocate 1 ETH to the tracked operating bucket"
        : `Allocate 1 ETH to ${bucket.label}`,
      buildDraft(amountWei, description) {
        if (bucket === undefined) {
          throw new Error("Add at least one tracked bucket before composing a budget allocation proposal.");
        }

        return {
          target: state.addresses.treasury,
          value: 0n,
          data: encodeTreasuryAllocateBudget({
            bucketId: bucket.id,
            amountWei,
          }),
          description,
          preview: `Treasury will allocate ${formatEth(amountWei)} to ${bucket.label}.`,
        };
      },
    },
    {
      key: "create-distribution",
      label: distribution === undefined
        ? "Create a tracked distribution event"
        : `Create distribution for ${distribution.label}`,
      defaultAmountEth: "1",
      defaultDescription: distribution === undefined
        ? "Create a 1 ETH community distribution"
        : `Create ${distribution.label} for 1 ETH`,
      buildDraft(amountWei, description) {
        if (distribution === undefined) {
          throw new Error("Add at least one tracked distribution before composing a distribution proposal.");
        }

        return {
          target: state.addresses.distributor,
          value: 0n,
          data: encodeDistributorCreateDistribution({
            distributionId: distribution.id,
            amountWei,
          }),
          description,
          preview: `Distributor will create ${distribution.label} with ${formatEth(amountWei)} available for funding.`,
        };
      },
    },
  ];
}

function updateGovernanceProposalPreview(state) {
  const proposalForm = document.querySelector("#governance-proposal-form");
  const preview = document.querySelector("#governance-proposal-preview");

  if (proposalForm === null || preview === null) {
    return;
  }

  try {
    const draft = buildGovernanceProposalDraft(state, proposalForm);
    preview.innerHTML = `
      <strong>${escapeHtml(proposalTargetLabel(draft.target, state))}</strong>
      <span>${escapeHtml(draft.preview)}</span>
      <span>Description: ${escapeHtml(draft.description)}</span>
    `;
  } catch (error) {
    preview.innerHTML = escapeHtml(toMessage(error));
  }
}

function buildGovernanceProposalDraft(state, proposalForm) {
  const composerOptions = governanceComposerOptions(state);
  const selected = composerOptions.find((option) => option.key === proposalForm.actionKey.value);

  if (selected === undefined) {
    throw new Error("Choose a supported proposal template.");
  }

  const amountWei = parseEthAmount(proposalForm.amountEth.value);

  if (amountWei <= 0n) {
    throw new Error("Proposal amount must be greater than zero.");
  }

  const description = proposalForm.description.value.trim();

  if (description.length === 0) {
    throw new Error("Proposal description is required.");
  }

  return selected.buildDraft(amountWei, description);
}

async function handleCreateGovernanceProposal() {
  try {
    const state = requireState();
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();
    const proposalForm = document.querySelector("#governance-proposal-form");

    if (proposalForm === null) {
      throw new Error("The proposal form is not available yet.");
    }

    const draft = buildGovernanceProposalDraft(state, proposalForm);

    setWriteStatus("Preparing governance proposal transaction.", "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await createGovernanceProposal({
      governorAddress: config.addresses.governanceGovernor,
      target: draft.target,
      value: draft.value,
      data: draft.data,
      description: draft.description,
    });

    setWriteStatus(`Proposal submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    latestWalletVotes = await refreshWalletVotes(config);
    await refresh();
    setWriteStatus(
      "Proposal created. It will appear in the governance list after the dashboard refresh completes.",
      "success",
    );
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

async function handleGovernanceVote(proposalId, support) {
  try {
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();

    setWriteStatus(`Submitting vote for proposal #${proposalId}.`, "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await castGovernanceVote({
      governorAddress: config.addresses.governanceGovernor,
      proposalId,
      support,
    });

    setWriteStatus(`Vote submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    latestWalletVotes = await refreshWalletVotes(config);
    await refresh();
    setWriteStatus(`Vote recorded for proposal #${proposalId}.`, "success");
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

async function handleGovernanceQueue(proposalId) {
  try {
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();

    setWriteStatus(`Queueing proposal #${proposalId} through the timelock.`, "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await queueGovernanceProposal({
      governorAddress: config.addresses.governanceGovernor,
      proposalId,
    });

    setWriteStatus(`Queue transaction submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    await refresh();
    setWriteStatus(`Proposal #${proposalId} is now queued in the timelock.`, "success");
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
}

async function handleGovernanceExecute(proposalId) {
  try {
    const config = requireConfig();
    const rpcChainId = requireRpcChainId();

    setWriteStatus(`Executing queued proposal #${proposalId}.`, "loading");
    await ensureWalletOnChain(rpcChainId, config.rpcUrl);

    const txHash = await executeGovernanceProposal({
      governorAddress: config.addresses.governanceGovernor,
      proposalId,
    });

    setWriteStatus(`Execution transaction submitted: ${txHash}`, "loading");
    await waitForTransactionReceipt(txHash);
    await refresh();
    setWriteStatus(`Proposal #${proposalId} executed.`, "success");
  } catch (error) {
    setWriteStatus(toMessage(error), "error");
  }
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
              ${escapeHtml(formatHistoryMoment(entry.timestamp))} - block ${entry.blockNumber}
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
  const demoRoleLabels = currentDemoActors().map((actor) => actor.role).join(", ");

  notePanel.innerHTML = `
    <ul class="notes-list">
      <li>Tracked buckets and distributions come from the configured ids because the current contracts do not enumerate them on-chain yet.</li>
      <li>The built-in defaults match a fresh local run of <code>npm run seed:demo:ui</code> against a new <code>hardhat node</code> instance.</li>
      <li>Native asset reads use ${escapeHtml(getNativeAssetAddress())} as the configured ETH sentinel address.</li>
      <li>The dashboard can now fund treasury custody, claim one tracked distribution, and submit narrow single-action governance proposals when the connected wallet has enough delegated votes.</li>
      <li>The activity feed is built from recent direct contract logs over the configured address set, without a separate indexing backend.</li>
      <li>There is no dedicated bucket creation event today, so budget allocation is the first bucket lifecycle step visible in the feed.</li>
      <li>Current dashboard chain: ${escapeHtml(chainLabel(state.rpcChainId))}</li>
      <li>Configured buckets: ${escapeHtml(config.trackedBuckets.map((bucket) => bucket.label).join(", "))}</li>
      <li>Configured distributions: ${escapeHtml(config.trackedDistributions.map((distribution) => distribution.label).join(", "))}</li>
      ${isLocalDemoMode(state) ? `<li>Suggested local demo roles: ${escapeHtml(demoRoleLabels)}.</li>` : ""}
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
    ${renderDemoRoleGuide()}
  `;

  const canUseWallet = walletState.available && walletState.account !== null && walletChainMatches;
  fundTreasuryButton.disabled = !canUseWallet;
  claimDistributionButton.disabled = !canUseWallet || !hasClaimableDistribution();
  switchWalletNetworkButton.disabled = !walletState.available || rpcChainId === null;
}

function renderDemoRoleGuide() {
  if (!isLocalDemoMode(latestState)) {
    return "";
  }

  return `
    <div class="callout-block">
      <strong>Suggested local demo roles</strong>
      <ul class="notes-list compact-list">
        ${currentDemoActors().map((actor) => {
          const isConnected = walletState.account !== null &&
            lower(walletState.account) === lower(actor.address);

          return `
            <li>
              <strong>${escapeHtml(actor.role)}</strong>
              (${escapeHtml(shortenAddress(actor.address))}, Hardhat account #${actor.walletIndex})${isConnected ? " - connected now" : ""}
              : ${escapeHtml(actor.story)}
            </li>
          `;
        }).join("")}
      </ul>
      <p class="wallet-note">
        These are local demo identities, not product user accounts. If you need them in MetaMask, import the matching Hardhat node accounts from your local chain output.
      </p>
    </div>
  `;
}

function renderTreasuryActionForm(state) {
  const buckets = latestConfig?.trackedBuckets ?? [];
  const previousSelection = treasuryGovernanceForm.bucketId.value;

  treasuryGovernanceForm.bucketId.innerHTML = buckets.length === 0
    ? '<option value="">No tracked buckets configured</option>'
    : buckets.map((bucket) => `
      <option value="${escapeHtml(bucket.id)}">${escapeHtml(bucket.label)}</option>
    `).join("");

  treasuryGovernanceForm.bucketId.value = buckets.some((bucket) => bucket.id === previousSelection)
    ? previousSelection
    : buckets[0]?.id ?? "";

  const selectedAction = treasuryGovernanceForm.actionKey.value;
  treasuryGovernanceForm.recipient.disabled = selectedAction !== "spend";
  if (selectedAction !== "spend") {
    treasuryGovernanceForm.recipient.value = "";
  }

  if (state === null) {
    treasuryActionPreview.innerHTML = "Refresh the dashboard to prepare treasury actions.";
    treasuryGovernanceButton.disabled = true;
    treasuryGovernanceButton.textContent = "Submit treasury proposal";
    return;
  }

  const proposalPermission = describeTreasuryProposalPermission(state);

  try {
    const draft = buildTreasuryActionDraft(state);
    treasuryActionPreview.innerHTML = `
      <strong>${escapeHtml(draft.title)}</strong>
      <span>${escapeHtml(draft.preview)}</span>
      <span>${escapeHtml(proposalPermission.detail)}</span>
    `;
    treasuryGovernanceButton.disabled = !proposalPermission.canSubmit;
    treasuryGovernanceButton.textContent = proposalPermission.canSubmit
      ? "Submit treasury proposal"
      : "Proposal unavailable";
  } catch (error) {
    treasuryActionPreview.innerHTML = escapeHtml(toMessage(error));
    treasuryGovernanceButton.disabled = true;
    treasuryGovernanceButton.textContent = "Proposal unavailable";
  }
}

function hydrateClaimSelector(config, state) {
  const previousSelection = claimDistributionSelect.value;

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

  const hasPreviousSelection = config.trackedDistributions.some(
    (distribution) => distribution.id === previousSelection,
  );
  claimDistributionSelect.value = hasPreviousSelection
    ? previousSelection
    : config.trackedDistributions[0]?.id ?? "";
}

function renderClaimPreview() {
  const distribution = latestState?.distributor.distributions.find(
    (item) => item.id === claimDistributionSelect.value,
  );

  if (distribution === undefined || distribution.status !== "loaded") {
    claimPreview.innerHTML = "Select a tracked distribution to preview its claim state.";
    claimDistributionButton.disabled = true;
    claimDistributionButton.textContent = "Claim remaining amount";
    return;
  }

  const remaining = distribution.fundedAmount - distribution.claimedAmount;
  const claimView = describeDistributionClaimState(distribution);
  const canClaim = claimView.canClaim;

  claimPreview.innerHTML = `
    <strong>${escapeHtml(distribution.label)}</strong>
    <span>Asset: ${escapeHtml(distributionAssetLabel(distribution.asset))}</span>
    <span>Remaining claimable amount: ${formatEth(remaining)}</span>
    <span>Status: ${distributionStatus(distribution.stateCode)}</span>
    <span>${escapeHtml(claimView.detail)}</span>
  `;

  claimDistributionButton.disabled = !canClaim;
  claimDistributionButton.textContent = canClaim
    ? "Claim full remaining amount"
    : "Claim unavailable";
}

function buildTreasuryActionDraft(state) {
  const bucketId = treasuryGovernanceForm.bucketId.value;
  const amountWei = parseEthAmount(treasuryGovernanceForm.amountEth.value);

  if (amountWei <= 0n) {
    throw new Error("Treasury action amount must be greater than zero.");
  }

  const bucket = latestConfig?.trackedBuckets.find((item) => item.id === bucketId);
  if (bucket === undefined) {
    throw new Error("Choose a tracked bucket before preparing a treasury action.");
  }

  if (treasuryGovernanceForm.actionKey.value === "allocate") {
    return {
      title: "Allocate budget to bucket",
      data: encodeTreasuryAllocateBudget({ bucketId, amountWei }),
      description: `Allocate ${formatEth(amountWei)} to ${bucket.label}`,
      preview: `This governance proposal will allocate ${formatEth(amountWei)} of operating capital to ${bucket.label}. In this MVP, the first allocation effectively creates the bucket.`,
    };
  }

  const recipient = requireAddress(treasuryGovernanceForm.recipient.value, "Spend recipient");

  return {
    title: "Spend from bucket",
    data: encodeTreasurySpend({ bucketId, recipient, amountWei }),
    description: `Spend ${formatEth(amountWei)} from ${bucket.label} to ${shortenAddress(recipient)}`,
    preview: `This governance proposal will spend ${formatEth(amountWei)} from ${bucket.label} to ${recipient}. The treasury only transfers funds after the proposal is approved and executed.`,
  };
}

function clearPanels() {
  healthPanel.innerHTML = "";
  summaryPanel.innerHTML = "";
  treasuryPanel.innerHTML = "";
  bucketsPanel.innerHTML = "";
  distributorPanel.innerHTML = "";
  rolesPanel.innerHTML = "";
  governancePanel.innerHTML = "";
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
    demoActors: latestConfig?.demoActors ?? structuredClone(demoDefaults.demoActors ?? []),
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

function distributionAssetLabel(asset) {
  return lower(asset) === lower(getNativeAssetAddress())
    ? "ETH"
    : shortenAddress(asset);
}

function describeTreasuryProposalPermission(state) {
  if (!walletState.available) {
    return {
      canSubmit: false,
      detail: "Open the dashboard in a browser with an injected wallet to prepare treasury proposals.",
    };
  }

  if (walletState.account === null) {
    return {
      canSubmit: false,
      detail: "Connect a wallet before creating a treasury proposal.",
    };
  }

  if (!walletMatchesDashboardChain()) {
    return {
      canSubmit: false,
      detail: "Switch the wallet to the same chain as the dashboard before creating a treasury proposal.",
    };
  }

  if (latestWalletVotes < state.governance.proposalThreshold) {
    return {
      canSubmit: false,
      detail: "This wallet does not appear to meet the current governor proposal threshold.",
    };
  }

  return {
    canSubmit: true,
    detail: `This wallet appears able to create treasury proposals through the governor. Treasury owner is currently ${shortenAddress(state.treasury.owner)}.`,
  };
}

function currentDemoActors() {
  return latestConfig?.demoActors ?? demoDefaults.demoActors ?? [];
}

function isLocalDemoMode(state) {
  return state !== null && normalizeChainId(state.rpcChainId) === "0x7a69" && currentDemoActors().length > 0;
}

function proposalStateLabel(code) {
  if (code === 0) {
    return "Pending";
  }
  if (code === 1) {
    return "Active";
  }
  if (code === 2) {
    return "Defeated";
  }
  if (code === 3) {
    return "Succeeded";
  }
  if (code === 4) {
    return "Queued";
  }
  if (code === 5) {
    return "Executed";
  }
  if (code === 6) {
    return "Canceled";
  }

  return `Unknown (${code})`;
}

function proposalStateTone(code) {
  if (code === 1 || code === 3 || code === 5) {
    return "success";
  }

  return "warning";
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

async function refreshWalletVotes(config) {
  if (config === null || walletState.account === null) {
    return 0n;
  }

  try {
    return await readTokenVotes(config.rpcUrl, config.addresses.governanceToken, walletState.account);
  } catch {
    return 0n;
  }
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

function deriveHealthView(state) {
  const roleView = deriveRoleView(state);
  const loadedAddresses = Object.values(state.addresses).filter((address) =>
    /^0x[a-fA-F0-9]{40}$/.test(address ?? "")
  ).length;
  const loadedBucketCount = state.treasury.buckets.filter((bucket) => bucket.status === "loaded").length;
  const bucketErrorCount = state.treasury.buckets.length - loadedBucketCount;
  const activeDistributionCount = state.distributor.distributions.filter((distribution) =>
    distribution.status === "loaded" && distribution.stateCode === 1
  ).length;
  const loadedDistributionCount = state.distributor.distributions.filter((distribution) =>
    distribution.status === "loaded"
  ).length;
  const distributionErrorCount = state.distributor.distributions.length - loadedDistributionCount;

  let readinessLabel = "Ready for governed demo";
  let readinessTone = "success";
  let readinessDetail = "Core module addresses are loaded, the treasury holds capital, and governance control appears handed off through the timelock path.";

  if (loadedAddresses < 5) {
    readinessLabel = "Configuration incomplete";
    readinessTone = "warning";
    readinessDetail = "One or more core module addresses are missing, so this dashboard view cannot fully evaluate the deployed system.";
  } else if (roleView.pathTone === "warning") {
    readinessLabel = "Governance wiring needs review";
    readinessTone = "warning";
    readinessDetail = "The governor and timelock do not yet appear fully aligned for queueing and execution, so the governed control path may not be ready.";
  } else if (roleView.modeTone === "warning") {
    readinessLabel = "Usable, but still bootstrap-managed";
    readinessTone = "warning";
    readinessDetail = "The system is readable and may still function for demos, but one or more modules or timelock roles remain outside the final governance-owned posture.";
  } else if (state.treasury.totalBalance === 0n) {
    readinessLabel = "Deployed, but unfunded";
    readinessTone = "warning";
    readinessDetail = "The core contracts appear deployed and handed off, but the treasury currently holds no native capital for the MVP flow.";
  }

  const warnings = [];

  if (state.treasury.totalBalance === 0n) {
    warnings.push("Treasury native custody is zero, so the capital operating story is not yet funded.");
  }

  if (activeDistributionCount === 0) {
    warnings.push("No active distribution events are loaded right now, so the claim flow may not have a live next step.");
  }

  if (roleView.modeTone === "warning") {
    warnings.push("The system still looks bootstrap-owned or only partly handed off, so control is not yet in the intended steady-state governance posture.");
  }

  if (roleView.pathTone === "warning") {
    warnings.push("Governor and timelock roles do not appear fully aligned, so proposal queueing or execution may be blocked by setup rather than policy.");
  }

  if (bucketErrorCount > 0) {
    warnings.push("One or more tracked bucket ids could not be loaded from the current treasury state. Check the configured demo bucket list.");
  }

  if (distributionErrorCount > 0) {
    warnings.push("One or more tracked distribution ids could not be loaded from the current distributor state. Check the configured event list.");
  }

  const interpretation = [
    "Addresses loaded confirms whether the dashboard has enough contract wiring to read the full MVP stack.",
    "Treasury custody and distributor outstanding show whether capital is actually present and whether any funded claims still exist.",
    `${roleView.modeLabel} means ${roleView.modeDetail.toLowerCase()}`,
  ];

  if (isLocalDemoMode(state)) {
    interpretation.push("This also looks like the seeded local demo chain, so the wallet role guide and tracked demo ids should line up with the default story.");
  } else {
    interpretation.push("This is a lightweight direct-read health view, not a full monitoring backend or authoritative production alerting layer.");
  }

  return {
    readinessLabel,
    readinessTone,
    readinessDetail,
    controlLabel: roleView.modeLabel,
    controlTone: roleView.modeTone,
    controlDetail: roleView.modeDetail,
    addressesLoaded: loadedAddresses,
    addressesExpected: 5,
    activeDistributionCount: activeDistributionCount.toString(),
    loadedBucketCount: loadedBucketCount.toString(),
    totalBucketCount: state.treasury.buckets.length.toString(),
    proposalCount: state.governance.proposalCount.toString(),
    warnings,
    clearMessage: "No obvious problems stood out from the current direct contract reads. For this MVP, the system looks coherent enough to explore.",
    interpretation,
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

function formatOptionalMoment(timestamp) {
  if (timestamp === null || timestamp === undefined) {
    return "Not yet";
  }

  return formatHistoryMoment(timestamp);
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

function describeDistributionClaimState(distribution) {
  if (distribution.status !== "loaded") {
    return {
      tone: "warning",
      canClaim: false,
      detail: "This tracked event could not be loaded from the current chain state.",
    };
  }

  const remaining = distribution.fundedAmount - distribution.claimedAmount;

  if (distribution.stateCode !== 1) {
    return {
      tone: "warning",
      canClaim: false,
      detail: "This event is not currently active for claims.",
    };
  }

  if (remaining <= 0n) {
    return {
      tone: "warning",
      canClaim: false,
      detail: "This event has already been fully claimed.",
    };
  }

  if (!walletState.available) {
    return {
      tone: "warning",
      canClaim: false,
      detail: "Open the dashboard in a browser with an injected wallet to claim from this event.",
    };
  }

  if (walletState.account === null) {
    return {
      tone: "warning",
      canClaim: false,
      detail: "Connect a wallet to self-claim the remaining funded amount.",
    };
  }

  if (!walletMatchesDashboardChain()) {
    return {
      tone: "warning",
      canClaim: false,
      detail: "Switch the wallet to the same chain as the dashboard before claiming.",
    };
  }

  return {
    tone: "success",
    canClaim: true,
    detail: "This wallet can submit one self-claim for the full remaining funded amount.",
  };
}

function walletMatchesDashboardChain() {
  return latestState?.rpcChainId !== undefined &&
    walletState.account !== null &&
    normalizeChainId(latestState.rpcChainId) === normalizeChainId(walletState.chainId);
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

function proposalTargetLabel(target, state) {
  const normalized = lower(target);

  if (normalized === lower(state.addresses.treasury)) {
    return "Treasury";
  }
  if (normalized === lower(state.addresses.distributor)) {
    return "Distributor";
  }
  if (normalized === lower(state.addresses.governanceTimelock)) {
    return "Timelock";
  }
  if (normalized === lower(state.addresses.governanceGovernor)) {
    return "Governor";
  }

  return `Target ${shortenAddress(target)}`;
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

function requireAddress(value, label) {
  const normalized = value.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw new Error(`${label} must be a valid 20-byte hex address.`);
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
