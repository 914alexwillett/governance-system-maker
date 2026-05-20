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
const INSTANCE_REGISTRY_STORAGE_KEY = "governance-capital-instance-registry-v1";
const INSTANCE_COMPARE_STORAGE_KEY = "governance-capital-instance-compare-v1";

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
const launchReadinessPanel = document.querySelector("#launch-readiness-panel");
const launchNextStepsPanel = document.querySelector("#launch-next-steps-panel");
const launchCommandPanel = document.querySelector("#launch-command-panel");
const guidedDemoPanel = document.querySelector("#guided-demo-panel");
const resetDeployerDefaultsButton = document.querySelector("#reset-deployer-defaults");
const copyLaunchCommandButton = document.querySelector("#copy-launch-command");
const copyLaunchEnvButton = document.querySelector("#copy-launch-env");
const copyLaunchConfigButton = document.querySelector("#copy-launch-config");
const downloadLaunchPacketButton = document.querySelector("#download-launch-packet");
const importLaunchOutputFileInput = document.querySelector("#import-launch-output-file");
const launchOutputImportTextarea = document.querySelector("#launch-output-import");
const applyLaunchOutputButton = document.querySelector("#apply-launch-output");
const loadLaunchOutputFileButton = document.querySelector("#load-launch-output-file");
const instanceStatusBanner = document.querySelector("#instance-status-banner");
const instanceSummaryPanel = document.querySelector("#instance-summary-panel");
const instanceListPanel = document.querySelector("#instance-list-panel");
const saveCurrentInstanceButton = document.querySelector("#save-current-instance");
const instanceCompareForm = document.querySelector("#instance-compare-form");
const comparePrimaryInstanceSelect = document.querySelector("#compare-primary-instance");
const compareSecondaryInstanceSelect = document.querySelector("#compare-secondary-instance");
const compareStatusBanner = document.querySelector("#compare-status-banner");
const comparePanel = document.querySelector("#compare-panel");

const form = document.querySelector("#config-form");
const statusBanner = document.querySelector("#status-banner");
const writeStatusBanner = document.querySelector("#write-status-banner");
const shareStateBanner = document.querySelector("#share-state-banner");
const healthPanel = document.querySelector("#health-panel");
const opsPanel = document.querySelector("#ops-panel");
const sandboxStatusBanner = document.querySelector("#sandbox-status-banner");
const sandboxTreasuryForm = document.querySelector("#sandbox-treasury-form");
const sandboxTreasuryPreview = document.querySelector("#sandbox-treasury-preview");
const sandboxDistributorForm = document.querySelector("#sandbox-distributor-form");
const sandboxDistributorPreview = document.querySelector("#sandbox-distributor-preview");
const sandboxGovernancePreview = document.querySelector("#sandbox-governance-preview");
const summaryPanel = document.querySelector("#summary-panel");
const treasuryPanel = document.querySelector("#treasury-panel");
const bucketsPanel = document.querySelector("#buckets-panel");
const runwayForm = document.querySelector("#runway-form");
const runwayPanel = document.querySelector("#runway-panel");
const distributionCampaignForm = document.querySelector("#distribution-campaign-form");
const distributionCampaignPanel = document.querySelector("#distribution-campaign-panel");
const distributorPanel = document.querySelector("#distributor-panel");
const rolesPanel = document.querySelector("#roles-panel");
const governanceAnalyticsPanel = document.querySelector("#governance-analytics-panel");
const governancePanel = document.querySelector("#governance-panel");
const timelockPanel = document.querySelector("#timelock-panel");
const historyPanel = document.querySelector("#history-panel");
const notePanel = document.querySelector("#note-panel");
const walletPanel = document.querySelector("#wallet-panel");
const resetButton = document.querySelector("#reset-defaults");
const copyDemoStateButton = document.querySelector("#copy-demo-state");
const downloadDemoStateButton = document.querySelector("#download-demo-state");
const loadDemoStateFileButton = document.querySelector("#load-demo-state-file");
const importDemoStateFileInput = document.querySelector("#import-demo-state-file");
const demoStateImportTextarea = document.querySelector("#demo-state-import");
const applyDemoStateButton = document.querySelector("#apply-demo-state");
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
let instanceRegistry = loadStoredInstanceRegistry();
let latestCompareResult = null;
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

  copyLaunchEnvButton.addEventListener("click", async () => {
    await handleCopyLaunchEnv();
  });

  copyLaunchConfigButton.addEventListener("click", async () => {
    await handleCopyLaunchConfig();
  });

  downloadLaunchPacketButton.addEventListener("click", () => {
    handleDownloadLaunchPacket();
  });

  applyLaunchOutputButton.addEventListener("click", async () => {
    await handleApplyLaunchOutputText();
  });

  loadLaunchOutputFileButton.addEventListener("click", () => {
    importLaunchOutputFileInput.click();
  });

  importLaunchOutputFileInput.addEventListener("change", async (event) => {
    await handleImportLaunchOutputFile(event);
  });

  saveCurrentInstanceButton.addEventListener("click", () => {
    handleSaveCurrentInstance();
  });

  instanceListPanel.addEventListener("click", async (event) => {
    await handleInstanceListAction(event);
  });

  instanceCompareForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleCompareInstances();
  });

  const config = loadStoredConfig();
  hydrateForm(config);
  latestConfig = config;
  renderInstanceManager();
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

  copyDemoStateButton.addEventListener("click", async () => {
    await handleCopyDemoState();
  });

  downloadDemoStateButton.addEventListener("click", () => {
    handleDownloadDemoState();
  });

  loadDemoStateFileButton.addEventListener("click", () => {
    importDemoStateFileInput.click();
  });

  importDemoStateFileInput.addEventListener("change", async (event) => {
    await handleImportDemoStateFile(event);
  });

  applyDemoStateButton.addEventListener("click", async () => {
    await handleApplyDemoStateText();
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

  sandboxTreasuryForm.actionKey.addEventListener("change", () => {
    renderSandboxMode(latestState);
  });
  sandboxTreasuryForm.bucketId.addEventListener("change", () => {
    renderSandboxMode(latestState);
  });
  sandboxTreasuryForm.amountEth.addEventListener("input", () => {
    renderSandboxMode(latestState);
  });

  sandboxDistributorForm.actionKey.addEventListener("change", () => {
    renderSandboxMode(latestState);
  });
  sandboxDistributorForm.distributionId.addEventListener("change", () => {
    renderSandboxMode(latestState);
  });
  sandboxDistributorForm.amountEth.addEventListener("input", () => {
    renderSandboxMode(latestState);
  });

  runwayForm.bucketId.addEventListener("change", () => {
    renderBudgetRunway(latestState);
  });
  runwayForm.monthlyBurnEth.addEventListener("input", () => {
    renderBudgetRunway(latestState);
  });

  distributionCampaignForm.distributionId.addEventListener("change", () => {
    renderDistributionCampaignSetup(latestState);
  });
  distributionCampaignForm.totalAmountEth.addEventListener("input", () => {
    renderDistributionCampaignSetup(latestState);
  });
  distributionCampaignForm.initialFundingEth.addEventListener("input", () => {
    renderDistributionCampaignSetup(latestState);
  });
  distributionCampaignForm.recipientCount.addEventListener("input", () => {
    renderDistributionCampaignSetup(latestState);
  });
  distributionCampaignForm.claimModel.addEventListener("change", () => {
    renderDistributionCampaignSetup(latestState);
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
    renderSandboxMode(latestState);
    renderTreasuryActionForm(latestState);
    renderGovernance(latestState);
    renderClaimPreview();
  });

  renderWalletPanel();
  renderSandboxMode(latestState);
  renderBudgetRunway(latestState);
  renderDistributionCampaignSetup(latestState);
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
    syncSavedInstanceFromLiveState(config, state);
    hydrateClaimSelector(config, state);
    renderHealth(state);
    renderOpsAdmin(state);
    renderSandboxMode(state);
    renderSummary(config, state);
    renderTreasury(state.treasury);
    renderBuckets(state.treasury.buckets);
    renderBudgetRunway(state);
    renderDistributionCampaignSetup(state);
    renderDistributor(state.distributor);
    renderRoles(state);
    renderGovernanceAnalytics(state);
    renderGovernance(state);
    renderTimelock(state.timelock);
    renderHistory(state.history);
    renderNotes(config, state);
    renderWalletPanel();
    renderTreasuryActionForm(state);
    renderClaimPreview();
    renderInstanceManager();
    setStatus("Dashboard updated from the current chain state.", "success");
  } catch (error) {
    latestState = null;
    clearPanels();
    renderHealth(null);
    renderOpsAdmin(null);
    renderSandboxMode(null);
    renderBudgetRunway(null);
    renderDistributionCampaignSetup(null);
    renderWalletPanel();
    renderTreasuryActionForm(null);
    renderGovernanceAnalytics(null);
    renderGovernance(null);
    renderClaimPreview();
    renderInstanceManager();
    setStatus(
      `${toMessage(error)} Check that the local chain is running and the configured addresses match the latest seeded deployment.`,
      "error",
    );
  }
}

function handleSaveCurrentInstance() {
  try {
    const config = normalizeDashboardConfig(readFormConfig());
    const existing = findSavedInstance(config);
    const record = buildInstanceRecord({
      config,
      state: latestState,
      sourceType: existing?.sourceType ?? "dashboard-config",
      label: existing?.label,
      metadata: existing?.metadata ?? {},
    });

    upsertInstanceRecord(record);
    setInstanceStatus(
      existing === null || existing === undefined
        ? `Saved ${record.label} to the local instance shelf.`
        : `Updated ${record.label} in the local instance shelf.`,
      "success",
    );
  } catch (error) {
    setInstanceStatus(toMessage(error), "error");
  }
}

async function handleCompareInstances() {
  const primaryId = comparePrimaryInstanceSelect.value;
  const secondaryId = compareSecondaryInstanceSelect.value;

  if (primaryId.length === 0 || secondaryId.length === 0) {
    setCompareStatus("Choose two saved instances before running a comparison.", "error");
    comparePanel.innerHTML = emptyState("Saved instances will appear here once the shelf has at least two records.");
    return;
  }

  if (primaryId === secondaryId) {
    setCompareStatus("Choose two different saved instances for a side-by-side comparison.", "error");
    return;
  }

  const primaryRecord = instanceRegistry.find((item) => item.id === primaryId);
  const secondaryRecord = instanceRegistry.find((item) => item.id === secondaryId);

  if (primaryRecord === undefined || secondaryRecord === undefined) {
    setCompareStatus("One of the selected instance records is no longer available.", "error");
    renderInstanceManager();
    return;
  }

  storeInstanceCompareSelection({
    primaryInstanceId: primaryId,
    secondaryInstanceId: secondaryId,
  });

  setCompareStatus("Loading live state for both selected instances.", "loading");

  const [primaryResult, secondaryResult] = await Promise.all([
    loadCompareTarget(primaryRecord),
    loadCompareTarget(secondaryRecord),
  ]);

  latestCompareResult = {
    primaryRecord,
    secondaryRecord,
    primaryResult,
    secondaryResult,
  };

  renderComparePanel(latestCompareResult);

  if (primaryResult.status === "success" && secondaryResult.status === "success") {
    setCompareStatus(
      `Compared ${primaryRecord.label} and ${secondaryRecord.label} using live RPC reads.`,
      "success",
    );
    return;
  }

  setCompareStatus(
    "Comparison loaded with partial data. One or both instances could not be read fully from their configured RPC endpoint.",
    "warning",
  );
}

async function handleInstanceListAction(event) {
  const actionButton = event.target.closest("[data-instance-action]");

  if (!(actionButton instanceof HTMLButtonElement)) {
    return;
  }

  const instanceId = actionButton.dataset.instanceId ?? "";

  if (instanceId.length === 0) {
    return;
  }

  if (actionButton.dataset.instanceAction === "remove") {
    forgetInstanceRecord(instanceId);
    return;
  }

  if (actionButton.dataset.instanceAction === "select") {
    await selectInstanceRecord(instanceId);
  }
}

async function selectInstanceRecord(instanceId) {
  const record = instanceRegistry.find((item) => item.id === instanceId);

  if (record === undefined) {
    setInstanceStatus("That saved instance is no longer available.", "error");
    renderInstanceManager();
    return;
  }

  hydrateForm(record.config);
  latestConfig = structuredClone(record.config);
  storeConfig(record.config);
  setInstanceStatus(`Loaded ${record.label} into the dashboard.`, "success");
  await refresh();
}

function forgetInstanceRecord(instanceId) {
  const record = instanceRegistry.find((item) => item.id === instanceId);

  if (record === undefined) {
    setInstanceStatus("That saved instance is no longer available.", "error");
    renderInstanceManager();
    return;
  }

  instanceRegistry = instanceRegistry.filter((item) => item.id !== instanceId);
  storeInstanceRegistry(instanceRegistry);
  renderInstanceManager();
  setInstanceStatus(`Removed ${record.label} from the local instance shelf.`, "success");
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

async function handleCopyDemoState() {
  try {
    const exportedState = JSON.stringify(buildShareableDemoState(), null, 2);
    await copyText(exportedState);
    setShareStateStatus(
      "Shareable demo state copied. You can paste it into another local dashboard instance.",
      "success",
    );
  } catch (error) {
    setShareStateStatus(toMessage(error), "error");
  }
}

function handleDownloadDemoState() {
  try {
    const shareableState = buildShareableDemoState();
    const networkLabel = latestState === null ? "dashboard" : chainLabel(latestState.rpcChainId)
      .replaceAll(/\s+/g, "-")
      .toLowerCase();
    const fileName = `governance-capital-demo-state-${networkLabel}.json`;

    downloadTextFile(fileName, `${JSON.stringify(shareableState, null, 2)}\n`);
    setShareStateStatus(
      `Shareable demo state downloaded as ${fileName}.`,
      "success",
    );
  } catch (error) {
    setShareStateStatus(toMessage(error), "error");
  }
}

async function handleImportDemoStateFile(event) {
  try {
    const input = event.currentTarget;
    const file = input?.files?.[0];

    if (file === undefined) {
      return;
    }

    const content = await file.text();
    demoStateImportTextarea.value = content;
    await applyImportedDemoState(content, "Loaded shared demo state file.");
  } catch (error) {
    setShareStateStatus(toMessage(error), "error");
  } finally {
    importDemoStateFileInput.value = "";
  }
}

async function handleApplyDemoStateText() {
  try {
    await applyImportedDemoState(
      demoStateImportTextarea.value,
      "Loaded pasted shared demo state.",
    );
  } catch (error) {
    setShareStateStatus(toMessage(error), "error");
  }
}

async function applyImportedDemoState(rawText, successMessage) {
  const imported = parseImportedDemoState(rawText);
  hydrateForm(imported.config);
  latestConfig = imported.config;
  storeConfig(imported.config);

  if (imported.instanceRecord !== null) {
    upsertInstanceRecord(imported.instanceRecord);
    setInstanceStatus(
      `Saved ${imported.instanceRecord.label} to the local instance shelf.`,
      "success",
    );
  }

  setShareStateStatus(successMessage, "success");
  await refresh();
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

  launchReadinessPanel.innerHTML = `
    <div class="roles-overview launch-readiness-grid">
      <div class="role-status-card" data-mode="${escapeHtml(launchPlan.readiness.deployTone)}">
        <span class="eyebrow">Launch posture</span>
        <strong>${escapeHtml(launchPlan.readiness.deployLabel)}</strong>
        <p>${escapeHtml(launchPlan.readiness.deployDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(launchPlan.readiness.envTone)}">
        <span class="eyebrow">Environment setup</span>
        <strong>${escapeHtml(launchPlan.readiness.envLabel)}</strong>
        <p>${escapeHtml(launchPlan.readiness.envDetail)}</p>
      </div>
    </div>
    <ul class="notes-list compact-list">
      ${launchPlan.readiness.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;

  launchNextStepsPanel.innerHTML = `
    <ol class="sequence-list">
      ${launchPlan.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
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

function renderInstanceManager() {
  const config = latestConfig ?? loadStoredConfig();
  const savedRecord = findSavedInstance(config);
  const selectedSummary = buildSelectedInstanceSummary(config, latestState, savedRecord);
  const compareSelection = loadStoredInstanceCompareSelection();

  instanceSummaryPanel.innerHTML = `
    <div class="roles-overview">
      <div class="role-status-card" data-mode="${escapeHtml(selectedSummary.selectionTone)}">
        <span class="eyebrow">Selection state</span>
        <strong>${escapeHtml(selectedSummary.selectionLabel)}</strong>
        <p>${escapeHtml(selectedSummary.selectionDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(selectedSummary.readinessTone)}">
        <span class="eyebrow">Instance posture</span>
        <strong>${escapeHtml(selectedSummary.readinessLabel)}</strong>
        <p>${escapeHtml(selectedSummary.readinessDetail)}</p>
      </div>
    </div>
    <div class="panel-grid compact">
      ${metricCard("Instance", selectedSummary.label)}
      ${metricCard("Source", selectedSummary.sourceLabel)}
      ${metricCard("Network", selectedSummary.networkLabel)}
      ${metricCard("Tracked buckets", selectedSummary.bucketCount)}
      ${metricCard("Tracked distributions", selectedSummary.distributionCount)}
      ${metricCard("Saved records", instanceRegistry.length)}
    </div>
    <p class="action-note">${escapeHtml(selectedSummary.note)}</p>
  `;

  if (instanceRegistry.length === 0) {
    instanceListPanel.innerHTML = emptyState(
      "No saved instances yet. Import deployment output, load a shared state bundle, or save the current dashboard config.",
    );
    comparePrimaryInstanceSelect.innerHTML = '<option value="">No saved instances</option>';
    compareSecondaryInstanceSelect.innerHTML = '<option value="">No saved instances</option>';
    comparePanel.innerHTML = emptyState(
      "Save or import at least two instances to use the side-by-side comparison view.",
    );
    return;
  }

  const selectedId = buildInstanceId(config);

  instanceListPanel.innerHTML = `
    <div class="instance-list">
      ${instanceRegistry.map((record) => renderInstanceCard(record, record.id === selectedId)).join("")}
    </div>
  `;

  renderCompareControls(compareSelection, selectedId);

  if (latestCompareResult !== null) {
    const primaryStillExists = instanceRegistry.some((record) => record.id === latestCompareResult.primaryRecord.id);
    const secondaryStillExists = instanceRegistry.some((record) => record.id === latestCompareResult.secondaryRecord.id);

    if (primaryStillExists && secondaryStillExists) {
      renderComparePanel(latestCompareResult);
      return;
    }
  }

  if (instanceRegistry.length < 2) {
    comparePanel.innerHTML = emptyState(
      "Add one more saved instance to compare two deployments side by side.",
    );
    return;
  }

  comparePanel.innerHTML = emptyState(
    "Choose two saved instances and use Compare instances to load a live side-by-side view.",
  );
}

function renderCompareControls(compareSelection, selectedId) {
  const primaryId = resolveCompareRecordId(
    compareSelection.primaryInstanceId,
    selectedId,
    0,
  );
  const secondaryId = resolveCompareRecordId(
    compareSelection.secondaryInstanceId,
    primaryId,
    1,
  );

  comparePrimaryInstanceSelect.innerHTML = instanceRegistry.map((record) => `
    <option value="${escapeHtml(record.id)}">${escapeHtml(record.label)}</option>
  `).join("");

  compareSecondaryInstanceSelect.innerHTML = instanceRegistry.map((record) => `
    <option value="${escapeHtml(record.id)}">${escapeHtml(record.label)}</option>
  `).join("");

  comparePrimaryInstanceSelect.value = primaryId;
  compareSecondaryInstanceSelect.value = secondaryId;

  storeInstanceCompareSelection({
    primaryInstanceId: primaryId,
    secondaryInstanceId: secondaryId,
  });
}

function resolveCompareRecordId(preferredId, fallbackAvoidId, fallbackIndex) {
  if (instanceRegistry.some((record) => record.id === preferredId)) {
    return preferredId;
  }

  const preferredFallback = instanceRegistry.find((record) =>
    record.id !== fallbackAvoidId
  );

  if (preferredFallback !== undefined && fallbackIndex !== 0) {
    return preferredFallback.id;
  }

  return instanceRegistry[fallbackIndex]?.id ?? instanceRegistry[0]?.id ?? "";
}

function buildSelectedInstanceSummary(config, state, savedRecord) {
  const roleView = state === null ? null : deriveRoleView(state);
  const healthView = state === null ? null : deriveHealthView(state);
  const record = savedRecord ?? buildInstanceRecord({
    config,
    state,
    sourceType: savedRecord?.sourceType ?? "dashboard-config",
    label: savedRecord?.label,
    metadata: savedRecord?.metadata ?? {},
  });

  return {
    label: record.label,
    sourceLabel: instanceSourceLabel(record.sourceType),
    networkLabel: record.metadata.networkLabel || inferNetworkLabelFromRpc(config.rpcUrl),
    bucketCount: String(config.trackedBuckets.length),
    distributionCount: String(config.trackedDistributions.length),
    selectionLabel: savedRecord === null ? "Current dashboard is not yet saved" : "Current dashboard matches a saved instance",
    selectionTone: savedRecord === null ? "warning" : "success",
    selectionDetail: savedRecord === null
      ? "You can still inspect this system now, but saving it makes it easier to switch back later from the local shelf."
      : `This dashboard configuration is already stored as ${record.label}.`,
    readinessLabel: healthView?.readinessLabel ?? "Config loaded, live state pending",
    readinessTone: healthView?.readinessTone ?? "warning",
    readinessDetail: healthView?.readinessDetail ?? "Refresh the dashboard against a live RPC endpoint to confirm health, control posture, and tracked ids.",
    note: roleView === null
      ? "Instance records are local browser convenience metadata. The authoritative part is still the RPC URL, deployed addresses, and tracked ids."
      : `Current control posture: ${roleView.modeLabel}. Saved instance metadata helps you switch contexts, but it does not replace live contract reads.`,
  };
}

function renderInstanceCard(record, isSelected) {
  const addressCount = Object.values(record.config.addresses).filter((address) =>
    /^0x[a-fA-F0-9]{40}$/.test(address ?? "")
  ).length;

  return `
    <article class="instance-card${isSelected ? " is-selected" : ""}">
      <div class="instance-card-head">
        <div>
          <span class="eyebrow">${escapeHtml(instanceSourceLabel(record.sourceType))}</span>
          <strong>${escapeHtml(record.label)}</strong>
          <p class="instance-copy">${escapeHtml(record.metadata.networkLabel || inferNetworkLabelFromRpc(record.config.rpcUrl))}</p>
        </div>
        <span class="history-pill" data-category="${escapeHtml(instanceCategory(record))}">
          ${escapeHtml(isSelected ? "Selected" : "Saved")}
        </span>
      </div>
      <div class="instance-meta-grid">
        <span><strong>RPC:</strong> ${escapeHtml(record.config.rpcUrl)}</span>
        <span><strong>Contracts:</strong> ${addressCount}/5 loaded</span>
        <span><strong>Buckets:</strong> ${record.config.trackedBuckets.length}</span>
        <span><strong>Distributions:</strong> ${record.config.trackedDistributions.length}</span>
        <span><strong>Control:</strong> ${escapeHtml(record.metadata.roleMode || "Unknown until live read")}</span>
        <span><strong>Last saved:</strong> ${escapeHtml(formatSavedMoment(record.savedAt))}</span>
      </div>
      <div class="button-row compact-row">
        <button type="button" data-instance-action="select" data-instance-id="${escapeHtml(record.id)}" ${isSelected ? "disabled" : ""}>
          ${isSelected ? "Currently selected" : "Use this instance"}
        </button>
        <button type="button" class="ghost-button" data-instance-action="remove" data-instance-id="${escapeHtml(record.id)}">
          Forget
        </button>
      </div>
    </article>
  `;
}

function renderComparePanel(result) {
  const primary = buildCompareView(result.primaryRecord, result.primaryResult);
  const secondary = buildCompareView(result.secondaryRecord, result.secondaryResult);
  const rows = [
    {
      label: "Instance label",
      left: primary.label,
      right: secondary.label,
    },
    {
      label: "Source",
      left: primary.source,
      right: secondary.source,
    },
    {
      label: "Network",
      left: primary.network,
      right: secondary.network,
    },
    {
      label: "RPC status",
      left: primary.rpcStatus,
      right: secondary.rpcStatus,
    },
    {
      label: "Governor address",
      left: primary.governorAddress,
      right: secondary.governorAddress,
    },
    {
      label: "Timelock address",
      left: primary.timelockAddress,
      right: secondary.timelockAddress,
    },
    {
      label: "Governance posture",
      left: primary.controlPosture,
      right: secondary.controlPosture,
    },
    {
      label: "Voting delay",
      left: primary.votingDelay,
      right: secondary.votingDelay,
    },
    {
      label: "Voting period",
      left: primary.votingPeriod,
      right: secondary.votingPeriod,
    },
    {
      label: "Proposal threshold",
      left: primary.proposalThreshold,
      right: secondary.proposalThreshold,
    },
    {
      label: "Timelock delay",
      left: primary.timelockDelay,
      right: secondary.timelockDelay,
    },
    {
      label: "Treasury custody",
      left: primary.treasuryCustody,
      right: secondary.treasuryCustody,
    },
    {
      label: "Available operating",
      left: primary.availableOperating,
      right: secondary.availableOperating,
    },
    {
      label: "Tracked buckets loaded",
      left: primary.bucketSummary,
      right: secondary.bucketSummary,
    },
    {
      label: "Distributor outstanding",
      left: primary.distributorOutstanding,
      right: secondary.distributorOutstanding,
    },
    {
      label: "Active distributions",
      left: primary.activeDistributions,
      right: secondary.activeDistributions,
    },
    {
      label: "Tracked distributions loaded",
      left: primary.distributionSummary,
      right: secondary.distributionSummary,
    },
    {
      label: "Proposal count",
      left: primary.proposalCount,
      right: secondary.proposalCount,
    },
  ];

  comparePanel.innerHTML = `
    <div class="compare-summary-grid">
      <div class="role-status-card" data-mode="${escapeHtml(primary.tone)}">
        <span class="eyebrow">Left instance</span>
        <strong>${escapeHtml(primary.label)}</strong>
        <p>${escapeHtml(primary.summary)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(secondary.tone)}">
        <span class="eyebrow">Right instance</span>
        <strong>${escapeHtml(secondary.label)}</strong>
        <p>${escapeHtml(secondary.summary)}</p>
      </div>
    </div>
    <div class="compare-table">
      <div class="compare-row compare-head">
        <span>Dimension</span>
        <span>${escapeHtml(primary.label)}</span>
        <span>${escapeHtml(secondary.label)}</span>
      </div>
      ${rows.map((row) => `
        <div class="compare-row">
          <span class="compare-label">${escapeHtml(row.label)}</span>
          <span>${renderCompareValue(row.left)}</span>
          <span>${renderCompareValue(row.right)}</span>
        </div>
      `).join("")}
    </div>
    <p class="action-note">
      This MVP comparison reads the two selected RPC targets directly and focuses on high-value top-level signals.
      It is not a full configuration diff or historical analysis engine.
    </p>
  `;
}

function renderCompareValue(value) {
  return value === ""
    ? "Unavailable"
    : escapeHtml(value);
}

function buildCompareView(record, result) {
  if (result.status === "error") {
    return {
      label: record.label,
      source: instanceSourceLabel(record.sourceType),
      network: record.metadata.networkLabel || inferNetworkLabelFromRpc(record.config.rpcUrl),
      rpcStatus: "Unavailable",
      governorAddress: shortenAddress(record.config.addresses.governanceGovernor),
      timelockAddress: shortenAddress(record.config.addresses.governanceTimelock),
      controlPosture: record.metadata.roleMode || "Unavailable",
      votingDelay: "",
      votingPeriod: "",
      proposalThreshold: "",
      timelockDelay: "",
      treasuryCustody: "",
      availableOperating: "",
      bucketSummary: `${record.config.trackedBuckets.length} tracked / unavailable live read`,
      distributorOutstanding: "",
      activeDistributions: "",
      distributionSummary: `${record.config.trackedDistributions.length} tracked / unavailable live read`,
      proposalCount: "",
      tone: "warning",
      summary: result.error,
    };
  }

  const state = result.state;
  const roleView = deriveRoleView(state);
  const activeDistributions = state.distributor.distributions.filter((distribution) =>
    distribution.status === "loaded" && distribution.stateCode === 1
  ).length;
  const loadedBuckets = state.treasury.buckets.filter((bucket) => bucket.status === "loaded").length;
  const loadedDistributions = state.distributor.distributions.filter((distribution) =>
    distribution.status === "loaded"
  ).length;

  return {
    label: record.label,
    source: instanceSourceLabel(record.sourceType),
    network: chainLabel(state.rpcChainId),
    rpcStatus: "Live read ok",
    governorAddress: shortenAddress(state.addresses.governanceGovernor),
    timelockAddress: shortenAddress(state.addresses.governanceTimelock),
    controlPosture: roleView.modeLabel,
    votingDelay: state.governance.votingDelay.toString(),
    votingPeriod: state.governance.votingPeriod.toString(),
    proposalThreshold: formatEth(state.governance.proposalThreshold),
    timelockDelay: formatSeconds(state.governance.timelockMinDelay),
    treasuryCustody: formatEth(state.treasury.totalBalance),
    availableOperating: formatEth(state.treasury.availableOperating),
    bucketSummary: `${loadedBuckets} / ${state.treasury.buckets.length}`,
    distributorOutstanding: formatEth(state.distributor.totalOutstanding),
    activeDistributions: activeDistributions.toString(),
    distributionSummary: `${loadedDistributions} / ${state.distributor.distributions.length}`,
    proposalCount: state.governance.proposalCount.toString(),
    tone: roleView.modeTone,
    summary: `${roleView.modeLabel}. Treasury holds ${formatEth(state.treasury.totalBalance)} and distributor outstanding is ${formatEth(state.distributor.totalOutstanding)}.`,
  };
}

async function loadCompareTarget(record) {
  try {
    const state = await loadDashboardState(record.config);
    return {
      status: "success",
      state,
    };
  } catch (error) {
    return {
      status: "error",
      error: toMessage(error),
    };
  }
}

async function handleCopyLaunchEnv() {
  try {
    if (latestLaunchPlan === null) {
      throw new Error("Generate a launch plan before copying environment setup.");
    }

    await copyText(latestLaunchPlan.envExample);
    setDeployerStatus("Environment setup copied.", "success");
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  }
}

function handleDownloadLaunchPacket() {
  try {
    if (latestLaunchPlan === null) {
      throw new Error("Generate a launch plan before downloading a launch packet.");
    }

    const fileName = `${latestLaunchPlan.systemLabel.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "").toLowerCase() || "governance-capital-launch"}-launch-packet.json`;
    downloadTextFile(fileName, `${JSON.stringify(buildLaunchPacket(latestLaunchPlan), null, 2)}\n`);
    setDeployerStatus(`Launch packet downloaded as ${fileName}.`, "success");
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  }
}

async function handleApplyLaunchOutputText() {
  try {
    await applyImportedDemoState(
      launchOutputImportTextarea.value,
      "Deployment output loaded into the dashboard config.",
    );
    setDeployerStatus(
      "Deployment output loaded. The dashboard is now pointed at the new instance.",
      "success",
    );
    document.querySelector("#dashboard-config-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  }
}

async function handleImportLaunchOutputFile(event) {
  try {
    const input = event.currentTarget;
    const file = input?.files?.[0];

    if (file === undefined) {
      return;
    }

    const content = await file.text();
    launchOutputImportTextarea.value = content;
    await applyImportedDemoState(
      content,
      "Deployment output file loaded into the dashboard config.",
    );
    setDeployerStatus(
      "Deployment output file loaded. The dashboard is now pointed at the new instance.",
      "success",
    );
    document.querySelector("#dashboard-config-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    setDeployerStatus(toMessage(error), "error");
  } finally {
    importLaunchOutputFileInput.value = "";
  }
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

function renderOpsAdmin(state) {
  if (state === null) {
    opsPanel.innerHTML = emptyState("Refresh the dashboard to load the operator-facing status view.");
    return;
  }

  const opsView = deriveOpsAdminView(state);

  opsPanel.innerHTML = `
    <div class="roles-overview">
      <div class="role-status-card" data-mode="${escapeHtml(opsView.postureTone)}">
        <span class="eyebrow">Control status</span>
        <strong>${escapeHtml(opsView.postureLabel)}</strong>
        <p>${escapeHtml(opsView.postureDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(opsView.treasuryTone)}">
        <span class="eyebrow">Treasury operations</span>
        <strong>${escapeHtml(opsView.treasuryLabel)}</strong>
        <p>${escapeHtml(opsView.treasuryDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(opsView.distributorTone)}">
        <span class="eyebrow">Distributor operations</span>
        <strong>${escapeHtml(opsView.distributorLabel)}</strong>
        <p>${escapeHtml(opsView.distributorDetail)}</p>
      </div>
    </div>
    <div class="panel-grid compact">
      ${metricCard("Timelock owner path", opsView.ownerPath)}
      ${metricCard("Available operating", formatEth(state.treasury.availableOperating))}
      ${metricCard("Outstanding claims", formatEth(state.distributor.totalOutstanding))}
      ${metricCard("Active distributions", opsView.activeDistributionCount)}
      ${metricCard("Tracked buckets", opsView.bucketSummary)}
      ${metricCard("Queued or ready proposals", opsView.queueSummary)}
    </div>
    <div class="actions-layout">
      <div class="action-card">
        <h3>Available Now</h3>
        <div class="history-feed">
          ${opsView.availableActions.map((action) => `
            <article class="history-item proposal-card" data-tone="${escapeHtml(action.tone)}">
              <div class="history-head">
                <span class="history-pill" data-category="${escapeHtml(action.category)}">${escapeHtml(action.categoryLabel)}</span>
                <span class="role-badge" data-tone="${escapeHtml(action.tone)}">${escapeHtml(action.status)}</span>
              </div>
              <strong class="history-title">${escapeHtml(action.label)}</strong>
              <p class="history-detail">${escapeHtml(action.detail)}</p>
            </article>
          `).join("")}
        </div>
      </div>
      <div class="action-card">
        <h3>Warnings And Blockers</h3>
        ${opsView.warnings.length === 0
          ? `<p class="action-copy">${escapeHtml(opsView.clearMessage)}</p>`
          : `
            <ul class="notes-list">
              ${opsView.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
            </ul>
          `}
      </div>
      <div class="action-card">
        <h3>Intentionally Not Exposed</h3>
        <ul class="notes-list">
          ${opsView.withheldActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderSandboxMode(state) {
  hydrateSandboxSelectors(state);

  if (state === null) {
    sandboxStatusBanner.dataset.tone = "loading";
    sandboxStatusBanner.textContent = "Sandbox mode is waiting for live dashboard state. Refresh the dashboard first, then experiment with preview-only scenarios.";
    sandboxTreasuryPreview.innerHTML = "Refresh the dashboard to preview hypothetical treasury changes.";
    sandboxDistributorPreview.innerHTML = "Refresh the dashboard to preview hypothetical distribution changes.";
    sandboxGovernancePreview.innerHTML = "Refresh the dashboard to preview the current governance lifecycle timing.";
    return;
  }

  sandboxStatusBanner.dataset.tone = "success";
  sandboxStatusBanner.textContent = "Sandbox mode is using the current live dashboard state as its starting point. These results are simulated and do not send transactions.";
  renderSandboxTreasuryPreview(state);
  renderSandboxDistributorPreview(state);
  renderSandboxGovernancePreview(state);
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

function renderBudgetRunway(state) {
  const buckets = latestConfig?.trackedBuckets ?? [];
  const previousSelection = runwayForm.bucketId.value;

  runwayForm.bucketId.innerHTML = buckets.length === 0
    ? '<option value="">No tracked buckets configured</option>'
    : buckets.map((bucket) => `
      <option value="${escapeHtml(bucket.id)}">${escapeHtml(bucket.label)}</option>
    `).join("");

  runwayForm.bucketId.value = buckets.some((bucket) => bucket.id === previousSelection)
    ? previousSelection
    : buckets[0]?.id ?? "";

  if (state === null) {
    runwayPanel.innerHTML = emptyState(
      "Refresh the dashboard to forecast runway from the current treasury bucket state.",
    );
    return;
  }

  try {
    const runwayView = deriveBudgetRunwayView(state);

    runwayPanel.innerHTML = `
      <div class="history-item proposal-card" data-tone="${escapeHtml(runwayView.tone)}">
        <div class="history-head">
          <span class="history-pill" data-category="treasury">Forecast</span>
          <span class="role-badge" data-tone="${escapeHtml(runwayView.tone)}">${escapeHtml(runwayView.label)}</span>
        </div>
        <strong class="history-title">${escapeHtml(runwayView.title)}</strong>
        <p class="history-detail">${escapeHtml(runwayView.detail)}</p>
        <div class="panel-grid compact">
          ${metricCard("Actual allocated", runwayView.allocated)}
          ${metricCard("Actual spent", runwayView.spent)}
          ${metricCard("Actual remaining", runwayView.remaining)}
          ${metricCard("Spent ratio", runwayView.spentRatio)}
          ${metricCard("Assumed monthly burn", runwayView.assumedBurn)}
          ${metricCard("Estimated runway", runwayView.estimatedRunway)}
        </div>
        <ul class="notes-list compact-list">
          ${runwayView.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `;
  } catch (error) {
    runwayPanel.innerHTML = escapeHtml(toMessage(error));
  }
}

function renderDistributionCampaignSetup(state) {
  const trackedDistributions = latestConfig?.trackedDistributions ?? [];
  const previousSelection = distributionCampaignForm.distributionId.value;

  distributionCampaignForm.distributionId.innerHTML = trackedDistributions.length === 0
    ? '<option value="">No tracked distributions configured</option>'
    : trackedDistributions.map((distribution) => `
      <option value="${escapeHtml(distribution.id)}">${escapeHtml(distribution.label)}</option>
    `).join("");

  distributionCampaignForm.distributionId.value = trackedDistributions.some(
    (distribution) => distribution.id === previousSelection,
  )
    ? previousSelection
    : trackedDistributions[0]?.id ?? "";

  if (trackedDistributions.length === 0) {
    distributionCampaignPanel.innerHTML = emptyState(
      "Add or import at least one tracked distribution id before preparing a campaign setup flow.",
    );
    return;
  }

  try {
    const campaignView = deriveDistributionCampaignView(state);

    distributionCampaignPanel.innerHTML = `
      <div class="history-item proposal-card" data-tone="${escapeHtml(campaignView.tone)}">
        <div class="history-head">
          <span class="history-pill" data-category="distribution">Campaign</span>
          <span class="role-badge" data-tone="${escapeHtml(campaignView.tone)}">${escapeHtml(campaignView.label)}</span>
        </div>
        <strong class="history-title">${escapeHtml(campaignView.title)}</strong>
        <p class="history-detail">${escapeHtml(campaignView.detail)}</p>
        <div class="panel-grid compact">
          ${metricCard("Distribution id", campaignView.distributionId)}
          ${metricCard("Total amount", campaignView.totalAmount)}
          ${metricCard("Planned initial funding", campaignView.initialFunding)}
          ${metricCard("Unfunded remainder", campaignView.unfundedRemainder)}
          ${metricCard("Recipient count", campaignView.recipientCount)}
          ${metricCard("Claim model", campaignView.claimModel)}
        </div>
        <div class="actions-layout campaign-setup-layout">
          <div class="action-card">
            <h3>Required Inputs</h3>
            <ul class="notes-list compact-list">
              ${campaignView.requiredInputs.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
          <div class="action-card">
            <h3>Funding Relationship</h3>
            <ul class="notes-list compact-list">
              ${campaignView.fundingNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
          <div class="action-card">
            <h3>What Is Supported Now</h3>
            <ul class="notes-list compact-list">
              ${campaignView.supportNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        </div>
        <div class="callout-block">
          <strong>Proof and claim tooling</strong>
          <pre class="code-block">${escapeHtml(campaignView.toolingCommand)}</pre>
          <p class="action-copy">${escapeHtml(campaignView.toolingDetail)}</p>
        </div>
      </div>
    `;
  } catch (error) {
    distributionCampaignPanel.innerHTML = escapeHtml(toMessage(error));
  }
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

function renderGovernanceAnalytics(state) {
  if (state === null) {
    governanceAnalyticsPanel.innerHTML = emptyState(
      "Refresh the dashboard to load governance activity and participation signals.",
    );
    return;
  }

  const analytics = deriveGovernanceAnalyticsView(state);

  governanceAnalyticsPanel.innerHTML = `
    <div class="roles-overview">
      <div class="role-status-card" data-mode="success">
        <span class="eyebrow">Proposal activity</span>
        <strong>${escapeHtml(analytics.activityLabel)}</strong>
        <p>${escapeHtml(analytics.activityDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(analytics.participationTone)}">
        <span class="eyebrow">Participation proxy</span>
        <strong>${escapeHtml(analytics.participationLabel)}</strong>
        <p>${escapeHtml(analytics.participationDetail)}</p>
      </div>
      <div class="role-status-card" data-mode="${escapeHtml(analytics.executionTone)}">
        <span class="eyebrow">Queue and execution</span>
        <strong>${escapeHtml(analytics.executionLabel)}</strong>
        <p>${escapeHtml(analytics.executionDetail)}</p>
      </div>
    </div>
    <div class="panel-grid compact">
      ${metricCard("Proposal count", analytics.proposalCount)}
      ${metricCard("Active", analytics.stateCounts.active)}
      ${metricCard("Queued", analytics.stateCounts.queued)}
      ${metricCard("Executed", analytics.stateCounts.executed)}
      ${metricCard("Defeated", analytics.stateCounts.defeated)}
      ${metricCard("Canceled", analytics.stateCounts.canceled)}
      ${metricCard("Proposals with votes", analytics.proposalsWithVotes)}
      ${metricCard("Average recorded votes", analytics.averageVotes)}
      ${metricCard("Peak recorded votes", analytics.peakVotes)}
    </div>
    <div class="actions-layout">
      <div class="action-card">
        <h3>Proposal State Mix</h3>
        <ul class="notes-list">
          ${analytics.stateMix.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      <div class="action-card">
        <h3>Recent Proposal Activity</h3>
        ${analytics.recentActivity.length === 0
          ? `<p class="action-copy">No proposals have been created on this deployment yet.</p>`
          : `
            <div class="history-feed">
              ${analytics.recentActivity.map((item) => `
                <article class="history-item proposal-card" data-tone="${escapeHtml(item.tone)}">
                  <div class="history-head">
                    <span class="history-pill" data-category="governance">${escapeHtml(item.badge)}</span>
                    <span class="role-badge" data-tone="${escapeHtml(item.tone)}">${escapeHtml(item.stateLabel)}</span>
                  </div>
                  <strong class="history-title">${escapeHtml(item.title)}</strong>
                  <p class="history-detail">${escapeHtml(item.detail)}</p>
                </article>
              `).join("")}
            </div>
          `}
      </div>
      <div class="action-card">
        <h3>How To Read This</h3>
        <ul class="notes-list">
          ${analytics.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
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

function hydrateSandboxSelectors(state) {
  const buckets = latestConfig?.trackedBuckets ?? [];
  const previousBucket = sandboxTreasuryForm.bucketId.value;

  sandboxTreasuryForm.bucketId.innerHTML = buckets.length === 0
    ? '<option value="">No tracked buckets configured</option>'
    : buckets.map((bucket) => `
      <option value="${escapeHtml(bucket.id)}">${escapeHtml(bucket.label)}</option>
    `).join("");

  sandboxTreasuryForm.bucketId.value = buckets.some((bucket) => bucket.id === previousBucket)
    ? previousBucket
    : buckets[0]?.id ?? "";

  const previousDistribution = sandboxDistributorForm.distributionId.value;
  const trackedDistributions = latestConfig?.trackedDistributions ?? [];

  sandboxDistributorForm.distributionId.innerHTML = trackedDistributions.length === 0
    ? '<option value="">No tracked distributions configured</option>'
    : trackedDistributions.map((distribution) => {
      const liveDistribution = state?.distributor.distributions.find((item) => item.id === distribution.id);
      const status = liveDistribution === undefined || liveDistribution.status !== "loaded"
        ? "unloaded"
        : distributionStatus(liveDistribution.stateCode).toLowerCase();

      return `
        <option value="${escapeHtml(distribution.id)}">
          ${escapeHtml(distribution.label)} (${escapeHtml(status)})
        </option>
      `;
    }).join("");

  sandboxDistributorForm.distributionId.value = trackedDistributions.some((distribution) =>
    distribution.id === previousDistribution
  )
    ? previousDistribution
    : trackedDistributions[0]?.id ?? "";
}

function renderSandboxTreasuryPreview(state) {
  try {
    const amountWei = parseEthAmount(sandboxTreasuryForm.amountEth.value);

    if (amountWei <= 0n) {
      throw new Error("Sandbox treasury amount must be greater than zero.");
    }

    const actionKey = sandboxTreasuryForm.actionKey.value;
    const bucket = state.treasury.buckets.find((item) => item.id === sandboxTreasuryForm.bucketId.value);
    let tone = "success";
    let title = "";
    let detail = "";
    let liveCards = "";
    let simulatedCards = "";

    if (actionKey === "classify") {
      if (amountWei > state.treasury.unallocated) {
        throw new Error("This preview would classify more capital than is currently unallocated.");
      }

      title = "Simulated operating classification";
      detail = `This preview classifies ${formatEth(amountWei)} from unallocated custody into operating capital.`;
      liveCards = [
        metricCard("Live unallocated", formatEth(state.treasury.unallocated)),
        metricCard("Live operating", formatEth(state.treasury.operating)),
      ].join("");
      simulatedCards = [
        metricCard("Simulated unallocated", formatEth(state.treasury.unallocated - amountWei)),
        metricCard("Simulated operating", formatEth(state.treasury.operating + amountWei)),
      ].join("");
    } else if (actionKey === "allocate") {
      if (bucket === undefined || bucket.status !== "loaded") {
        throw new Error("Choose a loaded tracked bucket for this sandbox preview.");
      }
      if (amountWei > state.treasury.availableOperating) {
        throw new Error("This preview would allocate more than the currently available operating capital.");
      }

      title = "Simulated bucket allocation";
      detail = `This preview allocates ${formatEth(amountWei)} to ${bucket.label}. In the current MVP, a first allocation is effectively what makes a bucket active.`;
      liveCards = [
        metricCard("Live available operating", formatEth(state.treasury.availableOperating)),
        metricCard("Live bucket remaining", formatEth(bucket.remaining)),
      ].join("");
      simulatedCards = [
        metricCard("Simulated available operating", formatEth(state.treasury.availableOperating - amountWei)),
        metricCard("Simulated bucket remaining", formatEth(bucket.remaining + amountWei)),
      ].join("");
    } else {
      if (bucket === undefined || bucket.status !== "loaded") {
        throw new Error("Choose a loaded tracked bucket for this sandbox preview.");
      }
      if (amountWei > bucket.remaining) {
        throw new Error("This preview would spend more than the bucket currently has remaining.");
      }

      title = "Simulated bucket spend";
      detail = `This preview spends ${formatEth(amountWei)} from ${bucket.label} and reduces live treasury custody by the same amount.`;
      tone = amountWei === bucket.remaining ? "warning" : "success";
      liveCards = [
        metricCard("Live treasury custody", formatEth(state.treasury.totalBalance)),
        metricCard("Live bucket remaining", formatEth(bucket.remaining)),
      ].join("");
      simulatedCards = [
        metricCard("Simulated treasury custody", formatEth(state.treasury.totalBalance - amountWei)),
        metricCard("Simulated bucket remaining", formatEth(bucket.remaining - amountWei)),
      ].join("");
    }

    sandboxTreasuryPreview.innerHTML = `
      <div class="history-item proposal-card" data-tone="${escapeHtml(tone)}">
        <div class="history-head">
          <span class="history-pill" data-category="treasury">Simulated</span>
          <span class="role-badge" data-tone="${escapeHtml(tone)}">${tone === "success" ? "Within current bounds" : "High impact"}</span>
        </div>
        <strong class="history-title">${escapeHtml(title)}</strong>
        <p class="history-detail">${escapeHtml(detail)}</p>
        <div class="panel-grid compact">${liveCards}</div>
        <div class="panel-grid compact">${simulatedCards}</div>
      </div>
    `;
  } catch (error) {
    sandboxTreasuryPreview.innerHTML = escapeHtml(toMessage(error));
  }
}

function renderSandboxDistributorPreview(state) {
  try {
    const amountWei = parseEthAmount(sandboxDistributorForm.amountEth.value);

    if (amountWei <= 0n) {
      throw new Error("Sandbox distributor amount must be greater than zero.");
    }

    const distribution = state.distributor.distributions.find(
      (item) => item.id === sandboxDistributorForm.distributionId.value,
    );

    if (distribution === undefined || distribution.status !== "loaded") {
      throw new Error("Choose a loaded tracked distribution for this sandbox preview.");
    }

    const remaining = distribution.fundedAmount - distribution.claimedAmount;
    const actionKey = sandboxDistributorForm.actionKey.value;
    let title = "";
    let detail = "";
    let tone = "success";
    let simulatedFunded = distribution.fundedAmount;
    let simulatedClaimed = distribution.claimedAmount;

    if (actionKey === "fund") {
      if (distribution.fundedAmount + amountWei > distribution.totalAmount) {
        throw new Error("This preview would fund the event beyond its declared total amount.");
      }

      title = "Simulated distribution funding";
      detail = `This preview adds ${formatEth(amountWei)} of funding to ${distribution.label}.`;
      simulatedFunded = distribution.fundedAmount + amountWei;
    } else {
      if (distribution.stateCode !== 1) {
        throw new Error("This preview can only claim against a currently active distribution.");
      }
      if (amountWei > remaining) {
        throw new Error("This preview would claim more than the distribution currently has remaining.");
      }

      title = "Simulated distribution claim";
      detail = `This preview claims ${formatEth(amountWei)} from ${distribution.label}.`;
      tone = amountWei === remaining ? "warning" : "success";
      simulatedClaimed = distribution.claimedAmount + amountWei;
    }

    const simulatedRemaining = simulatedFunded - simulatedClaimed;

    sandboxDistributorPreview.innerHTML = `
      <div class="history-item proposal-card" data-tone="${escapeHtml(tone)}">
        <div class="history-head">
          <span class="history-pill" data-category="distribution">Simulated</span>
          <span class="role-badge" data-tone="${escapeHtml(tone)}">${tone === "success" ? "Within current bounds" : "Full-state change"}</span>
        </div>
        <strong class="history-title">${escapeHtml(title)}</strong>
        <p class="history-detail">${escapeHtml(detail)}</p>
        <div class="panel-grid compact">
          ${metricCard("Live funded", formatEth(distribution.fundedAmount))}
          ${metricCard("Live claimed", formatEth(distribution.claimedAmount))}
          ${metricCard("Live remaining", formatEth(remaining))}
        </div>
        <div class="panel-grid compact">
          ${metricCard("Simulated funded", formatEth(simulatedFunded))}
          ${metricCard("Simulated claimed", formatEth(simulatedClaimed))}
          ${metricCard("Simulated remaining", formatEth(simulatedRemaining))}
        </div>
      </div>
    `;
  } catch (error) {
    sandboxDistributorPreview.innerHTML = escapeHtml(toMessage(error));
  }
}

function renderSandboxGovernancePreview(state) {
  const walletReady = walletState.available && walletState.account !== null && walletMatchesDashboardChain();
  const enoughVotes = latestWalletVotes >= state.governance.proposalThreshold;
  const createdAtBlock = state.governance.currentBlockNumber;
  const votingDelay = Number(state.governance.votingDelay);
  const votingPeriod = Number(state.governance.votingPeriod);
  const timelockDelaySeconds = Number(state.governance.timelockMinDelay);
  const activeAtBlock = createdAtBlock + votingDelay;
  const endsAtBlock = activeAtBlock + votingPeriod;
  const earliestExecutionAt = state.governance.currentTimestamp + timelockDelaySeconds;

  sandboxGovernancePreview.innerHTML = `
    <div class="history-item proposal-card" data-tone="${escapeHtml(walletReady && enoughVotes ? "success" : "warning")}">
      <div class="history-head">
        <span class="history-pill" data-category="governance">Simulated</span>
        <span class="role-badge" data-tone="${escapeHtml(walletReady && enoughVotes ? "success" : "warning")}">
          ${walletReady && enoughVotes ? "Wallet could propose" : "Read-first preview"}
        </span>
      </div>
      <strong class="history-title">If a proposal were created now</strong>
      <p class="history-detail">
        This preview uses the current governor voting delay, voting period, and timelock delay. It does not submit a proposal or predict voting outcomes.
      </p>
      <div class="panel-grid compact">
        ${metricCard("Current block", createdAtBlock.toString())}
        ${metricCard("Voting starts", `Block ${activeAtBlock.toString()}`)}
        ${metricCard("Voting ends", `Block ${endsAtBlock.toString()}`)}
        ${metricCard("Earliest execution", formatOptionalMoment(earliestExecutionAt))}
      </div>
      <ul class="notes-list compact-list">
        <li>${escapeHtml(walletReady
          ? enoughVotes
            ? "This connected wallet appears to meet the current proposal threshold, so a real proposal could be submitted from the live governance panel."
            : "This connected wallet does not appear to meet the current proposal threshold, so this remains a timing preview only."
          : "This is still useful as a timeline preview, but real proposal actions require a connected wallet on the same chain.")}</li>
        <li>Queueing still depends on the proposal succeeding.</li>
        <li>Execution still depends on queueing and the timelock delay elapsing.</li>
      </ul>
    </div>
  `;
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
  opsPanel.innerHTML = "";
  sandboxTreasuryPreview.innerHTML = "";
  sandboxDistributorPreview.innerHTML = "";
  sandboxGovernancePreview.innerHTML = "";
  summaryPanel.innerHTML = "";
  treasuryPanel.innerHTML = "";
  bucketsPanel.innerHTML = "";
  runwayPanel.innerHTML = "";
  distributionCampaignPanel.innerHTML = "";
  distributorPanel.innerHTML = "";
  rolesPanel.innerHTML = "";
  governanceAnalyticsPanel.innerHTML = "";
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

function setShareStateStatus(message, tone) {
  shareStateBanner.textContent = message;
  shareStateBanner.dataset.tone = tone;
}

function setInstanceStatus(message, tone) {
  instanceStatusBanner.textContent = message;
  instanceStatusBanner.dataset.tone = tone;
}

function setCompareStatus(message, tone) {
  compareStatusBanner.textContent = message;
  compareStatusBanner.dataset.tone = tone;
}

function loadStoredInstanceRegistry() {
  const raw = window.localStorage.getItem(INSTANCE_REGISTRY_STORAGE_KEY);

  if (raw === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeInstanceRecord(item))
      .filter((item) => item.config !== null);
  } catch {
    return [];
  }
}

function storeInstanceRegistry(registry) {
  window.localStorage.setItem(INSTANCE_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
}

function loadStoredInstanceCompareSelection() {
  const raw = window.localStorage.getItem(INSTANCE_COMPARE_STORAGE_KEY);

  if (raw === null) {
    return {
      primaryInstanceId: "",
      secondaryInstanceId: "",
    };
  }

  try {
    const parsed = JSON.parse(raw);

    return {
      primaryInstanceId: normalizeMaybeText(parsed?.primaryInstanceId, ""),
      secondaryInstanceId: normalizeMaybeText(parsed?.secondaryInstanceId, ""),
    };
  } catch {
    return {
      primaryInstanceId: "",
      secondaryInstanceId: "",
    };
  }
}

function storeInstanceCompareSelection(selection) {
  window.localStorage.setItem(
    INSTANCE_COMPARE_STORAGE_KEY,
    JSON.stringify(selection),
  );
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
    readiness: {
      deployLabel: profile.deployMode === "testnet"
        ? "Real testnet launch path"
        : "Safe rehearsal launch path",
      deployTone: profile.deployMode === "testnet" ? "warning" : "success",
      deployDetail: profile.deployMode === "testnet"
        ? "This profile maps to a real external network, so the launcher stays review-first and expects you to run the deploy script from a terminal."
        : "This profile is the easiest way to rehearse a real launch flow locally before moving to a public testnet.",
      envLabel: profile.requiredEnvVars.length === 0
        ? "No extra secrets required"
        : `${profile.requiredEnvVars.length} environment values required`,
      envTone: profile.requiredEnvVars.length === 0 ? "success" : "warning",
      envDetail: profile.requiredEnvVars.length === 0
        ? "The current profile can run without extra environment setup beyond your local node."
        : "This profile needs explicit RPC and deployer key values before the terminal launch will succeed.",
      checklist: [
        `Review the module stack for ${profile.label}.`,
        "Confirm token identity, supply, and timelock delay before copying the launch packet.",
        profile.requiredEnvVars.length === 0
          ? "Start the target local node before running the deploy command."
          : `Set ${profile.requiredEnvVars.join(" and ")} in your terminal session.`,
        "Run the copied deploy command outside the browser.",
        "Paste the deployment output JSON back into this launcher to inspect the new instance in the dashboard.",
      ],
    },
    nextSteps: [
      "Run the copied deploy command in a terminal that has the right network access and environment values.",
      "After deployment, copy the JSON printed under Deployment Output (JSON).",
      "Paste that JSON into Paste deployment output JSON and load it into the dashboard.",
      profile.deployMode === "persistent-local"
        ? "Optionally run the demo seed flow on the same chain if you want a fuller post-launch walkthrough."
        : "If you want a demo-style system state later, run the seed tooling against a compatible network with explicit addresses configured.",
    ],
    notes: profile.notes,
  };
}

function buildLaunchPacket(launchPlan) {
  return {
    version: "launch-packet-v1",
    exportedAt: new Date().toISOString(),
    systemLabel: launchPlan.systemLabel,
    networkProfile: launchPlan.profile.networkName,
    command: launchPlan.command,
    requiredEnvVars: launchPlan.envVars,
    envExample: launchPlan.envExample,
    modules: launchPlan.modules,
    handoffSteps: launchPlan.handoffSteps,
    configPreview: launchPlan.configPreview,
    readiness: launchPlan.readiness,
    nextSteps: launchPlan.nextSteps,
    notes: [
      "This packet is a review and execution aid for the existing off-chain deployment flow.",
      "It does not deploy contracts by itself and does not represent an on-chain factory launch.",
      "After a real deployment, paste the deploy script JSON output back into the launcher to configure the dashboard for the new instance.",
    ],
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

function buildShareableDemoState() {
  const config = latestConfig ?? readFormConfig();
  const roleView = latestState === null ? null : deriveRoleView(latestState);
  const currentRecord = findSavedInstance(config);
  const activeDistributionCount = latestState === null
    ? null
    : latestState.distributor.distributions.filter((distribution) =>
      distribution.status === "loaded" && distribution.stateCode === 1
    ).length;

  return {
    version: "demo-state-v1",
    exportedAt: new Date().toISOString(),
    source: latestState === null ? "dashboard-config" : "live-dashboard-read",
    authoritativeConfig: {
      rpcUrl: config.rpcUrl,
      addresses: config.addresses,
      trackedBuckets: config.trackedBuckets,
      trackedDistributions: config.trackedDistributions,
    },
    instanceMetadata: {
      label: currentRecord?.label ?? inferInstanceLabel({ config, state: latestState }),
      sourceType: currentRecord?.sourceType ?? (latestState === null ? "dashboard-config" : "live-dashboard-read"),
    },
    convenienceMetadata: {
      demoActors: config.demoActors ?? [],
      history: config.history ?? structuredClone(demoDefaults.history),
      roleMode: roleView?.modeLabel ?? "Unknown until live state is loaded",
      rpcChain: latestState === null ? "Unknown until live state is loaded" : chainLabel(latestState.rpcChainId),
      treasuryNativeBalance: latestState === null ? null : formatEth(latestState.treasury.totalBalance),
      activeDistributionCount,
      notes: [
        "authoritativeConfig is the reusable part of this export: RPC URL, contract addresses, and tracked ids.",
        "convenienceMetadata is for demo readability only. It helps another dashboard instance explain the setup, but it does not recreate chain state.",
        "This export does not include private keys, historical storage, or a full on-chain snapshot.",
      ],
    },
  };
}

function parseImportedDemoState(rawText) {
  const trimmed = rawText.trim();

  if (trimmed.length === 0) {
    throw new Error("Paste a shared state bundle or choose a state file first.");
  }

  let parsed;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("The shared state input is not valid JSON.");
  }

  if (parsed.version === "demo-state-v1" && parsed.authoritativeConfig !== undefined) {
    const config = normalizeDashboardConfig({
      ...parsed.authoritativeConfig,
      demoActors: parsed.convenienceMetadata?.demoActors,
      history: parsed.convenienceMetadata?.history,
    });

    return {
      config,
      instanceRecord: buildInstanceRecord({
        config,
        sourceType: "shareable-state",
        label: parsed.instanceMetadata?.label,
        metadata: {
          importedFrom: parsed.source,
          roleMode: parsed.convenienceMetadata?.roleMode,
          networkLabel: parsed.convenienceMetadata?.rpcChain,
          sourceType: parsed.instanceMetadata?.sourceType,
        },
      }),
    };
  }

  if (parsed.deployedAddresses !== undefined) {
    const config = normalizeDashboardConfig({
      rpcUrl: latestConfig?.rpcUrl ?? demoDefaults.rpcUrl,
      addresses: parsed.deployedAddresses,
      trackedBuckets: parsed.demoStory?.operationsBucketId === undefined
        ? []
        : [
          {
            id: parsed.demoStory.operationsBucketId,
            label: "Seeded operating bucket",
          },
        ],
      trackedDistributions: parsed.demoStory?.distributionId === undefined
        ? []
        : [
          {
            id: parsed.demoStory.distributionId,
            label: parsed.demoStory.distributionLabel ?? "Seeded distribution event",
          },
      ],
      demoActors: parsed.demoActors,
      history: latestConfig?.history ?? structuredClone(demoDefaults.history),
    });

    const sourceType = parsed.preset !== undefined || parsed.handoffSteps !== undefined
      ? "deployment-output"
      : "seeded-demo";

    return {
      config,
      instanceRecord: buildInstanceRecord({
        config,
        sourceType,
        metadata: {
          importedFrom: sourceType,
          networkLabel: parsed.networkLabel ?? parsed.network,
          chainId: parsed.chainId === undefined ? "" : String(parsed.chainId),
          presetLabel: parsed.preset?.label,
          roleMode: parsed.governance?.tokenOwner === undefined
            ? ""
            : inferRoleModeFromDeploymentOutput(parsed),
        },
      }),
    };
  }

  if (parsed.rpcUrl !== undefined && parsed.addresses !== undefined) {
    const config = normalizeDashboardConfig(parsed);

    return {
      config,
      instanceRecord: buildInstanceRecord({
        config,
        sourceType: "dashboard-config",
      }),
    };
  }

  throw new Error(
    "This JSON does not look like a dashboard export bundle, a seed script JSON summary, or a direct dashboard config object.",
  );
}

function normalizeDashboardConfig(partialConfig) {
  return {
    rpcUrl: typeof partialConfig.rpcUrl === "string" && partialConfig.rpcUrl.trim().length > 0
      ? partialConfig.rpcUrl.trim()
      : demoDefaults.rpcUrl,
    addresses: {
      governanceToken: normalizeMaybeText(
        partialConfig.addresses?.governanceToken,
        demoDefaults.addresses.governanceToken,
      ),
      treasury: normalizeMaybeText(
        partialConfig.addresses?.treasury,
        demoDefaults.addresses.treasury,
      ),
      distributor: normalizeMaybeText(
        partialConfig.addresses?.distributor,
        demoDefaults.addresses.distributor,
      ),
      governanceTimelock: normalizeMaybeText(
        partialConfig.addresses?.governanceTimelock,
        demoDefaults.addresses.governanceTimelock,
      ),
      governanceGovernor: normalizeMaybeText(
        partialConfig.addresses?.governanceGovernor,
        demoDefaults.addresses.governanceGovernor,
      ),
    },
    trackedBuckets: normalizeTrackedItems(
      partialConfig.trackedBuckets,
      demoDefaults.trackedBuckets,
      "Tracked bucket",
    ),
    trackedDistributions: normalizeTrackedItems(
      partialConfig.trackedDistributions,
      demoDefaults.trackedDistributions,
      "Tracked distribution",
    ),
    demoActors: normalizeDemoActors(
      partialConfig.demoActors,
      demoDefaults.demoActors ?? [],
    ),
    history: normalizeHistoryConfig(partialConfig.history),
  };
}

function normalizeInstanceRecord(value) {
  const config = normalizeDashboardConfig(value?.config ?? value ?? {});
  const metadata = normalizeInstanceMetadata(value?.metadata);

  return {
    id: normalizeMaybeText(value?.id, buildInstanceId(config)),
    label: normalizeMaybeText(
      value?.label,
      inferInstanceLabel({ config, metadata }),
    ),
    sourceType: normalizeMaybeText(value?.sourceType, "dashboard-config"),
    savedAt: normalizeMaybeText(value?.savedAt, new Date().toISOString()),
    config,
    metadata,
  };
}

function normalizeInstanceMetadata(value) {
  return {
    networkLabel: normalizeMaybeText(value?.networkLabel, ""),
    chainId: normalizeMaybeText(value?.chainId, ""),
    presetLabel: normalizeMaybeText(value?.presetLabel, ""),
    roleMode: normalizeMaybeText(value?.roleMode, ""),
    readinessLabel: normalizeMaybeText(value?.readinessLabel, ""),
    treasuryNativeBalance: normalizeMaybeText(value?.treasuryNativeBalance, ""),
    activeDistributionCount: normalizeMaybeText(value?.activeDistributionCount, ""),
    proposalCount: normalizeMaybeText(value?.proposalCount, ""),
    importedFrom: normalizeMaybeText(value?.importedFrom, ""),
    sourceType: normalizeMaybeText(value?.sourceType, ""),
  };
}

function buildInstanceId(config) {
  return [
    normalizeMaybeText(config.rpcUrl, demoDefaults.rpcUrl).toLowerCase(),
    lower(config.addresses?.governanceToken),
    lower(config.addresses?.treasury),
    lower(config.addresses?.distributor),
    lower(config.addresses?.governanceTimelock),
    lower(config.addresses?.governanceGovernor),
  ].join("|");
}

function inferInstanceLabel({ config, state = null, metadata = {} }) {
  if (typeof metadata.label === "string" && metadata.label.trim().length > 0) {
    return metadata.label.trim();
  }

  if (typeof metadata.networkLabel === "string" && metadata.networkLabel.trim().length > 0) {
    if (typeof metadata.presetLabel === "string" && metadata.presetLabel.trim().length > 0) {
      return `${metadata.networkLabel.trim()} - ${metadata.presetLabel.trim()}`;
    }

    return `${metadata.networkLabel.trim()} instance`;
  }

  if (state !== null && isLocalDemoMode(state)) {
    return "Seeded local demo instance";
  }

  const rpcUrl = normalizeMaybeText(config.rpcUrl, demoDefaults.rpcUrl).toLowerCase();

  if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1")) {
    return "Local governance capital instance";
  }

  return "Governance capital instance";
}

function buildInstanceRecord({
  config,
  state = null,
  sourceType,
  label,
  metadata = {},
}) {
  const roleView = state === null ? null : deriveRoleView(state);
  const healthView = state === null ? null : deriveHealthView(state);
  const activeDistributionCount = state === null
    ? metadata.activeDistributionCount
    : state.distributor.distributions.filter((distribution) =>
      distribution.status === "loaded" && distribution.stateCode === 1
    ).length.toString();
  const proposalCount = state === null
    ? metadata.proposalCount
    : state.governance.proposalCount.toString();
  const treasuryNativeBalance = state === null
    ? metadata.treasuryNativeBalance
    : formatEth(state.treasury.totalBalance);

  return normalizeInstanceRecord({
    id: buildInstanceId(config),
    label,
    sourceType,
    savedAt: new Date().toISOString(),
    config,
    metadata: {
      ...metadata,
      networkLabel: normalizeMaybeText(
        metadata.networkLabel,
        state === null ? inferNetworkLabelFromRpc(config.rpcUrl) : chainLabel(state.rpcChainId),
      ),
      chainId: normalizeMaybeText(
        metadata.chainId,
        state === null ? "" : normalizeChainId(state.rpcChainId),
      ),
      roleMode: normalizeMaybeText(metadata.roleMode, roleView?.modeLabel ?? ""),
      readinessLabel: normalizeMaybeText(metadata.readinessLabel, healthView?.readinessLabel ?? ""),
      treasuryNativeBalance: normalizeMaybeText(treasuryNativeBalance, ""),
      activeDistributionCount: normalizeMaybeText(activeDistributionCount, ""),
      proposalCount: normalizeMaybeText(proposalCount, ""),
      importedFrom: normalizeMaybeText(metadata.importedFrom, sourceType),
      sourceType: normalizeMaybeText(metadata.sourceType, sourceType),
    },
  });
}

function findSavedInstance(config) {
  const instanceId = buildInstanceId(config);
  return instanceRegistry.find((item) => item.id === instanceId) ?? null;
}

function upsertInstanceRecord(record) {
  const normalized = normalizeInstanceRecord(record);
  const currentIndex = instanceRegistry.findIndex((item) => item.id === normalized.id);

  if (currentIndex === -1) {
    instanceRegistry = [normalized, ...instanceRegistry];
  } else {
    const existing = instanceRegistry[currentIndex];
    const merged = normalizeInstanceRecord({
      ...existing,
      ...normalized,
      metadata: {
        ...existing.metadata,
        ...normalized.metadata,
      },
      savedAt: new Date().toISOString(),
    });
    instanceRegistry = instanceRegistry.map((item, index) => index === currentIndex ? merged : item);
  }

  instanceRegistry = instanceRegistry
    .slice()
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  storeInstanceRegistry(instanceRegistry);
  renderInstanceManager();

  return normalized;
}

function syncSavedInstanceFromLiveState(config, state) {
  const existing = findSavedInstance(config);

  if (existing === null) {
    return;
  }

  upsertInstanceRecord(buildInstanceRecord({
    config,
    state,
    sourceType: existing.sourceType,
    label: existing.label,
    metadata: existing.metadata,
  }));
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

function normalizeTrackedItems(value, fallback, defaultLabel) {
  if (!Array.isArray(value) || value.length === 0) {
    return structuredClone(fallback);
  }

  return value
    .map((item, index) => ({
      id: normalizeMaybeText(item?.id, ""),
      label: normalizeMaybeText(item?.label, `${defaultLabel} ${index + 1}`),
    }))
    .filter((item) => item.id.length > 0);
}

function normalizeDemoActors(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) {
    return structuredClone(fallback);
  }

  return value
    .map((actor, index) => ({
      role: normalizeRoleLabel(actor?.role, `Demo actor ${index + 1}`),
      walletIndex: typeof actor?.walletIndex === "number" ? actor.walletIndex : index,
      address: normalizeMaybeText(actor?.address, ""),
      story: normalizeMaybeText(actor?.story, "Shared demo actor."),
    }))
    .filter((actor) => actor.address.length > 0);
}

function normalizeHistoryConfig(value) {
  return {
    lookbackBlocks: normalizePositiveInteger(
      value?.lookbackBlocks,
      demoDefaults.history.lookbackBlocks,
    ),
    maxItems: normalizePositiveInteger(
      value?.maxItems,
      demoDefaults.history.maxItems,
    ),
  };
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

function deriveOpsAdminView(state) {
  const roleView = deriveRoleView(state);
  const healthView = deriveHealthView(state);
  const walletReady = walletState.available &&
    walletState.account !== null &&
    walletMatchesDashboardChain();
  const treasuryPermission = describeTreasuryProposalPermission(state);
  const activeDistributions = state.distributor.distributions.filter((distribution) =>
    distribution.status === "loaded" && distribution.stateCode === 1
  );
  const claimableDistributions = activeDistributions.filter((distribution) =>
    distribution.fundedAmount - distribution.claimedAmount > 0n
  );
  const loadedBuckets = state.treasury.buckets.filter((bucket) => bucket.status === "loaded");
  const queueableCount = state.governance.proposals.filter((proposal) => proposal.stateCode === 3).length;
  const executableCount = state.governance.proposals.filter((proposal) =>
    proposal.stateCode === 4 &&
    proposal.earliestExecutionTimestamp !== null &&
    state.governance.currentTimestamp >= proposal.earliestExecutionTimestamp
  ).length;

  let treasuryLabel = "Treasury is funded and readable";
  let treasuryTone = "success";
  let treasuryDetail = `Treasury custody is ${formatEth(state.treasury.totalBalance)} with ${formatEth(state.treasury.availableOperating)} still available for operating allocation.`;

  if (state.treasury.totalBalance === 0n) {
    treasuryLabel = "Treasury is deployed but unfunded";
    treasuryTone = "warning";
    treasuryDetail = "Capital custody is still empty, so treasury policy flows are visible but not yet economically meaningful.";
  } else if (state.treasury.availableOperating === 0n && state.treasury.operating > 0n) {
    treasuryLabel = "Operating capital is fully committed";
    treasuryTone = "warning";
    treasuryDetail = "The treasury still holds funds, but tracked operating capital is already committed into buckets or spent down.";
  }

  let distributorLabel = "Distribution flow is live";
  let distributorTone = "success";
  let distributorDetail = claimableDistributions.length > 0
    ? `${claimableDistributions.length} tracked distribution event${claimableDistributions.length === 1 ? "" : "s"} still has claimable funding.`
    : "Distributor events are readable, but there is no currently claimable tracked event.";

  if (activeDistributions.length === 0) {
    distributorLabel = "No active tracked distributions";
    distributorTone = "warning";
    distributorDetail = "The distributor is deployed, but the current tracked set does not include an active funded event.";
  } else if (claimableDistributions.length === 0) {
    distributorTone = "warning";
  }

  const availableActions = [
    {
      category: "treasury",
      categoryLabel: "Treasury",
      label: "Fund treasury custody",
      status: walletReady ? "Available" : "Blocked",
      tone: walletReady ? "success" : "warning",
      detail: walletReady
        ? "A connected wallet on the same chain can send ETH directly into treasury custody now."
        : walletExplanation(walletMatchesDashboardChain()),
    },
    {
      category: "governance",
      categoryLabel: "Governance",
      label: "Submit treasury proposal",
      status: treasuryPermission.canSubmit ? "Available" : "Blocked",
      tone: treasuryPermission.canSubmit ? "success" : "warning",
      detail: treasuryPermission.detail,
    },
    {
      category: "distribution",
      categoryLabel: "Distributor",
      label: "Claim tracked distribution",
      status: walletReady && claimableDistributions.length > 0 ? "Available" : "Blocked",
      tone: walletReady && claimableDistributions.length > 0 ? "success" : "warning",
      detail: claimableDistributions.length > 0
        ? (walletReady
          ? "A connected claimant can use the current self-claim path for one tracked funded event."
          : "A claimable tracked event exists, but the wallet must be connected on the same chain before claiming.")
        : "No tracked distribution currently has remaining claimable funding.",
    },
    {
      category: "governance",
      categoryLabel: "Governance",
      label: "Advance queued governance work",
      status: walletReady && (queueableCount > 0 || executableCount > 0) ? "Available" : "Review",
      tone: walletReady && (queueableCount > 0 || executableCount > 0) ? "success" : "warning",
      detail: executableCount > 0
        ? `${executableCount} queued proposal${executableCount === 1 ? "" : "s"} appears ready for execution now.`
        : queueableCount > 0
          ? `${queueableCount} succeeded proposal${queueableCount === 1 ? "" : "s"} is ready to be queued into the timelock.`
          : "No tracked proposal is currently at a queue-ready or execution-ready stage.",
    },
  ];

  return {
    postureLabel: roleView.modeLabel,
    postureTone: roleView.modeTone,
    postureDetail: `${roleView.modeDetail} ${roleView.pathDetail}`,
    treasuryLabel,
    treasuryTone,
    treasuryDetail,
    distributorLabel,
    distributorTone,
    distributorDetail,
    ownerPath: roleView.pathTone === "success" ? "Governor -> Timelock -> Modules" : "Needs review",
    activeDistributionCount: activeDistributions.length.toString(),
    bucketSummary: `${loadedBuckets.length} / ${state.treasury.buckets.length}`,
    queueSummary: executableCount > 0
      ? `${executableCount} executable`
      : queueableCount > 0
        ? `${queueableCount} queueable`
        : "None ready",
    availableActions,
    warnings: healthView.warnings,
    clearMessage: "No obvious operator blockers stand out right now. The current instance looks coherent enough to inspect and operate through the narrow MVP flows.",
    withheldActions: [
      "Direct owner-admin buttons for treasury classification, distributor funding, or timelock role changes are intentionally not exposed after handoff.",
      "This UI does not expose arbitrary calldata execution or broad admin scripting. Governance proposals stay narrow and reviewable on purpose.",
      "Tracked buckets and distribution events still come from configured ids because the current contracts do not enumerate them on-chain.",
    ],
  };
}

function deriveGovernanceAnalyticsView(state) {
  const proposals = state.governance.proposals;
  const counts = {
    pending: 0,
    active: 0,
    defeated: 0,
    succeeded: 0,
    queued: 0,
    executed: 0,
    canceled: 0,
    unknown: 0,
  };

  let totalRecordedVotes = 0n;
  let peakRecordedVotes = 0n;
  let proposalsWithVotes = 0;

  for (const proposal of proposals) {
    const recordedVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

    if (proposal.stateCode === 0) {
      counts.pending += 1;
    } else if (proposal.stateCode === 1) {
      counts.active += 1;
    } else if (proposal.stateCode === 2) {
      counts.defeated += 1;
    } else if (proposal.stateCode === 3) {
      counts.succeeded += 1;
    } else if (proposal.stateCode === 4) {
      counts.queued += 1;
    } else if (proposal.stateCode === 5) {
      counts.executed += 1;
    } else if (proposal.stateCode === 6) {
      counts.canceled += 1;
    } else {
      counts.unknown += 1;
    }

    totalRecordedVotes += recordedVotes;
    if (recordedVotes > 0n) {
      proposalsWithVotes += 1;
    }
    if (recordedVotes > peakRecordedVotes) {
      peakRecordedVotes = recordedVotes;
    }
  }

  const averageRecordedVotes = proposals.length === 0
    ? 0n
    : totalRecordedVotes / BigInt(proposals.length);
  const queueOrExecutionCount = counts.queued + counts.executed + counts.succeeded;

  return {
    proposalCount: state.governance.proposalCount.toString(),
    activityLabel: proposals.length === 0
      ? "No proposal activity yet"
      : `${proposals.length} proposal${proposals.length === 1 ? "" : "s"} recorded`,
    activityDetail: proposals.length === 0
      ? "This deployment has not created any governance proposals yet."
      : `${counts.active} active, ${counts.queued} queued, and ${counts.executed} executed proposal${counts.executed === 1 ? "" : "s"} are currently visible.`,
    participationTone: proposalsWithVotes > 0 ? "success" : "warning",
    participationLabel: proposalsWithVotes === 0
      ? "No recorded voting yet"
      : `${proposalsWithVotes} proposal${proposalsWithVotes === 1 ? "" : "s"} has recorded votes`,
    participationDetail: proposalsWithVotes === 0
      ? "The governor is readable, but the current proposal set does not yet show any recorded vote totals."
      : `Average recorded votes cast per proposal is ${formatEth(averageRecordedVotes)}. This is a participation proxy, not full turnout against the eligible voter base.`,
    executionTone: queueOrExecutionCount > 0 ? "success" : "warning",
    executionLabel: queueOrExecutionCount === 0
      ? "No proposal has reached queue or execution"
      : `${counts.succeeded + counts.queued + counts.executed} proposal${counts.succeeded + counts.queued + counts.executed === 1 ? "" : "s"} reached late-stage lifecycle`,
    executionDetail: queueOrExecutionCount === 0
      ? "Proposal creation is visible, but none of the current proposals has yet advanced into success, queueing, or execution."
      : `${counts.succeeded} succeeded, ${counts.queued} queued, and ${counts.executed} executed proposal${counts.executed === 1 ? "" : "s"} are currently visible.`,
    stateCounts: {
      active: counts.active.toString(),
      queued: counts.queued.toString(),
      executed: counts.executed.toString(),
      defeated: counts.defeated.toString(),
      canceled: counts.canceled.toString(),
    },
    proposalsWithVotes: proposalsWithVotes.toString(),
    averageVotes: formatEth(averageRecordedVotes),
    peakVotes: formatEth(peakRecordedVotes),
    stateMix: [
      `Pending: ${counts.pending}`,
      `Active: ${counts.active}`,
      `Succeeded: ${counts.succeeded}`,
      `Queued: ${counts.queued}`,
      `Executed: ${counts.executed}`,
      `Defeated: ${counts.defeated}`,
      `Canceled: ${counts.canceled}`,
      counts.unknown > 0 ? `Unknown: ${counts.unknown}` : "Unknown: 0",
    ],
    recentActivity: proposals
      .slice(0, 3)
      .map((proposal) => {
        const recordedVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

        return {
          badge: `Proposal #${proposal.proposalId}`,
          stateLabel: proposalStateLabel(proposal.stateCode),
          tone: proposalStateTone(proposal.stateCode),
          title: proposal.description || `Single-action proposal #${proposal.proposalId}`,
          detail: `${formatOptionalMoment(proposal.createdTimestamp)}. Recorded votes: ${formatEth(recordedVotes)}. Current state: ${proposalStateLabel(proposal.stateCode)}.`,
        };
      }),
    notes: [
      "Proposal state counts come from the current governor proposal reads in this dashboard, not from a separate analytics backend.",
      "Recorded votes are the current for, against, and abstain tallies visible on each proposal.",
      "Participation is shown as recorded votes cast, not as authoritative turnout against the full eligible token supply, because this MVP view does not currently index historical total-supply snapshots.",
      "Queue and execution signals reflect the real governor to timelock lifecycle already implemented in the current contracts.",
    ],
  };
}

function deriveBudgetRunwayView(state) {
  const bucketId = runwayForm.bucketId.value;
  const bucket = state.treasury.buckets.find((item) => item.id === bucketId);

  if (bucket === undefined || bucket.status !== "loaded") {
    throw new Error("Choose a loaded tracked bucket to forecast its runway.");
  }

  const monthlyBurnWei = parseEthAmount(runwayForm.monthlyBurnEth.value);

  if (monthlyBurnWei <= 0n) {
    throw new Error("Assumed monthly burn must be greater than zero.");
  }

  const spentRatioBps = bucket.allocated === 0n
    ? 0n
    : (bucket.spent * 10_000n) / bucket.allocated;
  const wholePercent = spentRatioBps / 100n;
  const fractionalPercent = (spentRatioBps % 100n).toString().padStart(2, "0");
  const remainingMonthsScaled = (bucket.remaining * 100n) / monthlyBurnWei;
  const wholeMonths = remainingMonthsScaled / 100n;
  const fractionalMonths = (remainingMonthsScaled % 100n).toString().padStart(2, "0");
  const estimatedDays = Number((bucket.remaining * 30n) / monthlyBurnWei);

  let tone = "success";
  let label = "Working estimate";
  let detail = `At the assumed burn rate of ${formatEth(monthlyBurnWei)} per month, ${bucket.label} would last about ${wholeMonths.toString()}.${fractionalMonths} months.`;

  if (bucket.remaining === 0n) {
    tone = "warning";
    label = "No runway remaining";
    detail = `${bucket.label} is already fully spent under current on-chain state.`;
  } else if (bucket.remaining < monthlyBurnWei) {
    tone = "warning";
    label = "Less than one month remaining";
    detail = `${bucket.label} would last less than one month at the assumed burn rate of ${formatEth(monthlyBurnWei)} per month.`;
  }

  return {
    tone,
    label,
    title: `${bucket.label} runway`,
    detail,
    allocated: formatEth(bucket.allocated),
    spent: formatEth(bucket.spent),
    remaining: formatEth(bucket.remaining),
    spentRatio: `${wholePercent.toString()}.${fractionalPercent}%`,
    assumedBurn: formatEth(monthlyBurnWei),
    estimatedRunway: bucket.remaining === 0n
      ? "0.00 months"
      : `${wholeMonths.toString()}.${fractionalMonths} months (~${estimatedDays} days)`,
    notes: [
      "Allocated, spent, and remaining are actual on-chain bucket values read from the treasury.",
      `The runway figure is derived by dividing the current remaining balance by the assumed monthly burn of ${formatEth(monthlyBurnWei)}.`,
      "This estimate assumes steady spend, no additional funding, and no governance-driven bucket changes during the forecast period.",
    ],
  };
}

function deriveDistributionCampaignView(state) {
  const trackedDistribution = latestConfig?.trackedDistributions.find(
    (distribution) => distribution.id === distributionCampaignForm.distributionId.value,
  );

  if (trackedDistribution === undefined) {
    throw new Error("Choose a tracked distribution template to prepare a campaign.");
  }

  const totalAmountWei = parseEthAmount(distributionCampaignForm.totalAmountEth.value);
  const initialFundingWei = parseEthAmount(distributionCampaignForm.initialFundingEth.value);
  const recipientCount = requireWholeNumber(
    distributionCampaignForm.recipientCount.value,
    "Expected claim recipients",
  );
  const claimModel = distributionCampaignForm.claimModel.value;

  if (totalAmountWei <= 0n) {
    throw new Error("Total event amount must be greater than zero.");
  }
  if (initialFundingWei <= 0n) {
    throw new Error("Planned initial funding must be greater than zero.");
  }
  if (initialFundingWei > totalAmountWei) {
    throw new Error("Planned initial funding cannot exceed the total event amount.");
  }

  const liveDistribution = state?.distributor.distributions.find(
    (distribution) => distribution.id === trackedDistribution.id,
  );
  const firstTrackedDistributionId = latestConfig?.trackedDistributions[0]?.id ?? "";
  const fullUiCreateSupport = trackedDistribution.id === firstTrackedDistributionId;
  const unfundedRemainder = totalAmountWei - initialFundingWei;

  return {
    tone: fullUiCreateSupport ? "success" : "warning",
    label: fullUiCreateSupport ? "Partially supported in the live UI" : "Guided preparation",
    title: `${trackedDistribution.label} campaign setup`,
    detail: liveDistribution?.status === "loaded"
      ? `${trackedDistribution.label} already exists in the current tracked state, so this panel should be treated as a setup checklist and proof/funding explainer rather than a fresh launch flow.`
      : `${trackedDistribution.label} can be prepared here as a new campaign concept. The current MVP separates on-chain event creation and funding from off-chain claim package preparation.`,
    distributionId: trackedDistribution.id,
    totalAmount: formatEth(totalAmountWei),
    initialFunding: formatEth(initialFundingWei),
    unfundedRemainder: formatEth(unfundedRemainder),
    recipientCount: recipientCount.toString(),
    claimModel: claimModel === "self-claim"
      ? "Current self-claim"
      : "Future-compatible artifact",
    requiredInputs: [
      `A stable distribution id such as ${trackedDistribution.id}. The current MVP treats this id as an externally chosen event identity.`,
      `An event total amount of ${formatEth(totalAmountWei)} and an initial funding plan of ${formatEth(initialFundingWei)}.`,
      `${recipientCount} intended claim recipient${recipientCount === 1 ? "" : "s"} prepared off-chain before the claim phase begins.`,
      claimModel === "self-claim"
        ? "For today's contract flow, each claimant ultimately needs distributionId, recipient, and amount."
        : "For a future entitlement-style flow, prepare a claim artifact with recipient amounts, Merkle leaves, and proofs off-chain.",
    ],
    fundingNotes: [
      "The Distributor can only fund events from assets it already holds.",
      "After handoff, createDistribution and fundDistribution are owner-gated and are intended to move through the governor and timelock path.",
      "The current seeded demo funds the distributor from ETH held by the timelock. The MVP does not yet present a productized treasury-to-distributor funding bridge.",
    ],
    supportNotes: [
      fullUiCreateSupport
        ? "The live governance panel can create the first tracked distribution as a real proposal today."
        : "The live governance panel currently only exposes a narrow create-distribution proposal flow for the first tracked distribution in Dashboard Config.",
      "Funding a distribution is real contract behavior, but the dashboard does not yet expose a full funding campaign wizard or direct governed funding action.",
      "Self-claiming from an active funded distribution is already a real UI flow once the event is live.",
    ],
    toolingCommand: "npx hardhat run scripts/prepare-distribution-claims.ts --build-profile production --network hardhatMainnet",
    toolingDetail: claimModel === "self-claim"
      ? "Use the current claim tooling to generate a clear claim package and future-compatible artifact notes, even though the on-chain MVP still uses self-claim requests rather than proof enforcement."
      : "Use the claim tooling to generate recipient claim entries, Merkle-style convenience data, and the exact current self-claim request shape for demos or tests.",
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

function instanceSourceLabel(sourceType) {
  if (sourceType === "deployment-output") {
    return "Deployment output";
  }
  if (sourceType === "shareable-state") {
    return "Shared state";
  }
  if (sourceType === "seeded-demo") {
    return "Seeded demo";
  }
  if (sourceType === "dashboard-config") {
    return "Manual config";
  }

  return "Saved instance";
}

function instanceCategory(record) {
  if ((record.metadata.roleMode ?? "").toLowerCase().includes("governance handoff")) {
    return "treasury";
  }

  if (record.sourceType === "deployment-output") {
    return "governance";
  }

  return "distribution";
}

function inferNetworkLabelFromRpc(rpcUrl) {
  const normalized = normalizeMaybeText(rpcUrl, demoDefaults.rpcUrl).toLowerCase();

  if (normalized.includes("sepolia")) {
    return "Ethereum Sepolia";
  }

  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) {
    return "Localhost JSON-RPC";
  }

  return "Custom RPC";
}

function inferRoleModeFromDeploymentOutput(parsed) {
  const timelock = lower(parsed.deployedAddresses?.governanceTimelock);
  const governor = lower(parsed.deployedAddresses?.governanceGovernor);
  const tokenOwner = lower(parsed.governance?.tokenOwner);
  const treasuryOwner = lower(parsed.governance?.treasuryOwner);
  const distributorOwner = lower(parsed.governance?.distributorOwner);
  const proposer = lower(parsed.governance?.timelockProposer);
  const executor = lower(parsed.governance?.timelockExecutor);
  const admin = lower(parsed.governance?.timelockAdmin);

  const fullyHandedOff = tokenOwner === timelock &&
    treasuryOwner === timelock &&
    distributorOwner === timelock &&
    proposer === governor &&
    executor === governor &&
    admin === timelock;

  return fullyHandedOff ? "Governance handoff complete" : "Bootstrap or partial handoff";
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

function formatSavedMoment(value) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "Unknown save time";
  }

  return new Date(timestamp).toLocaleString([], {
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

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function normalizeMaybeText(value, fallback) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeRoleLabel(value, fallback) {
  const normalized = normalizeMaybeText(value, fallback);

  if (normalized.includes("-")) {
    return normalized
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return normalized;
}

function normalizePositiveInteger(value, fallback) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
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
