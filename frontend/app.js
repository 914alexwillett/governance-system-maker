import { demoDefaults } from "./demo-config.js";
import { getNativeAssetAddress, loadDashboardState } from "./rpc.js";

const CONFIG_STORAGE_KEY = "governance-capital-demo-config-v1";

const form = document.querySelector("#config-form");
const statusBanner = document.querySelector("#status-banner");
const summaryPanel = document.querySelector("#summary-panel");
const treasuryPanel = document.querySelector("#treasury-panel");
const bucketsPanel = document.querySelector("#buckets-panel");
const distributorPanel = document.querySelector("#distributor-panel");
const timelockPanel = document.querySelector("#timelock-panel");
const notePanel = document.querySelector("#note-panel");
const resetButton = document.querySelector("#reset-defaults");

bootstrap();

function bootstrap() {
  const config = loadStoredConfig();
  hydrateForm(config);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await refresh();
  });

  resetButton.addEventListener("click", async () => {
    hydrateForm(structuredClone(demoDefaults));
    await refresh();
  });

  void refresh();
}

async function refresh() {
  const config = readFormConfig();
  storeConfig(config);
  setStatus("Loading live contract state from the configured RPC endpoint.", "loading");

  try {
    const state = await loadDashboardState(config);
    renderSummary(config, state);
    renderTreasury(state.treasury);
    renderBuckets(state.treasury.buckets);
    renderDistributor(state.distributor);
    renderTimelock(state.timelock);
    renderNotes(config);
    setStatus("Dashboard updated from the current chain state.", "success");
  } catch (error) {
    clearPanels();
    setStatus(
      `${toMessage(error)} Check that the local chain is running and the configured addresses match the latest seeded deployment.`,
      "error",
    );
  }
}

function renderSummary(config, state) {
  summaryPanel.innerHTML = `
    <div class="stat-card">
      <span class="eyebrow">RPC</span>
      <strong>${escapeHtml(config.rpcUrl)}</strong>
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
    <div class="stat-card">
      <span class="eyebrow">Governor</span>
      <code>${escapeHtml(state.addresses.governanceGovernor)}</code>
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

function renderNotes(config) {
  notePanel.innerHTML = `
    <ul class="notes-list">
      <li>This dashboard is read-only by design for the current MVP. Wallet integration is intentionally postponed.</li>
      <li>Tracked buckets and distributions come from the configured ids because the current contracts do not enumerate them on-chain yet.</li>
      <li>The built-in defaults match a fresh local run of <code>npm run seed:demo:ui</code> against a new <code>hardhat node</code> instance.</li>
      <li>Native asset reads use ${escapeHtml(getNativeAssetAddress())} as the configured ETH sentinel address.</li>
      <li>Configured buckets: ${escapeHtml(config.trackedBuckets.map((bucket) => bucket.label).join(", "))}</li>
      <li>Configured distributions: ${escapeHtml(config.trackedDistributions.map((distribution) => distribution.label).join(", "))}</li>
    </ul>
  `;
}

function clearPanels() {
  summaryPanel.innerHTML = "";
  treasuryPanel.innerHTML = "";
  bucketsPanel.innerHTML = "";
  distributorPanel.innerHTML = "";
  timelockPanel.innerHTML = "";
  notePanel.innerHTML = "";
}

function setStatus(message, tone) {
  statusBanner.textContent = message;
  statusBanner.dataset.tone = tone;
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

function emptyState(message) {
  return `<p class="empty-state">${escapeHtml(message)}</p>`;
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
