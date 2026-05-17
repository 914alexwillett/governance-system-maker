const SELECTORS = {
  owner: "0x8da5cb5b",
  getVotes: "0x9ab24eb0",
  totalBalance: "0x6eacd398",
  classifiedBalance: "0xc11b61c4",
  availableOperatingBalance: "0x3d4afd33",
  unallocatedBalance: "0x9467ba25",
  bucketStatus: "0x80869a4d",
  fundedAmount: "0x4b327343",
  totalOutstandingForAsset: "0x909ada5e",
  distributionState: "0x3af09f77",
  admin: "0xf851a440",
  proposer: "0xa8e4fb90",
  executor: "0xc34c08e5",
  minDelay: "0xc63c4e9b",
  proposalCount: "0xda35c664",
  proposalThreshold: "0xb58131b0",
  votingDelay: "0x3932abb1",
  votingPeriod: "0x02a251a3",
  quorumNumeratorBps: "0xbcca1b18",
  governorState: "0x3e4f49e6",
  proposalVotes: "0x544ffc9c",
  proposalSnapshot: "0x2d63f693",
  proposalDeadline: "0xc01f9e37",
};

const EVENT_TOPICS = {
  treasury: {
    nativeReceived: "0x58435332105b65235073eaf501c0b843adc1f880ecd4ec07b9bcfb5b9f04842c",
    capitalClassified: "0x8722f459d5ce462ec4d1ec20fd36ab0428338575e44f1750e430b3af377fa31d",
    budgetAllocated: "0xfea2ad7e445e9ab48f78daea8c78ded11deb676f8db73cdc3adb948f0f3b3afe",
    budgetDeallocated: "0x0c2f4a9df10030704102469d3be29dec87baa88e4fb5afe23f01235cfe94fa05",
    bucketSpent: "0x1ac0697084f55e198b9c128b2bffbe745539792903a947b2f07fa9faf4415765",
  },
  distributor: {
    created: "0xca68203d2a798f740eee885dd18926744321c2ff9fca6efed8d355955714172c",
    funded: "0x1f0a6ab761912292f8332f912932b8668d791b479938fccc5427df996da56147",
    claimed: "0xbf2f876389bf6f39a15cc34e855c18a466bb8b67ae28956b9c7911948c327225",
    closed: "0x58a6e95cbe95d2f8ab7ef17382c5c88cb1c68133d8140dfb2fd390103ebcd781",
  },
  governance: {
    proposalCreated: "0x32455ead38c8e1abb518e3e4e780e8d4d723dd901a6b5aa84c6b7ed7aaace822",
    voteCast: "0x2c9deb38f462962eadbd85a9d3a4120503ee091f1582eaaa10aa8c6797651d29",
    proposalQueued: "0x025b0c83fe178c6c2484be14bc8ffaaadb46e5136f7aba5e4fa7059edcd7161a",
    proposalExecuted: "0x56a007d3eea04bd347e571f3451382cb2a33ef5fd102b9a63846ff8d787f43cf",
  },
};

const NATIVE_ASSET = "0x0000000000000000000000000000000000000000";

export async function loadDashboardState(config) {
  const rpcChainId = await rpcRequest(config.rpcUrl, "eth_chainId");
  const governance = await loadGovernanceState(config);
  const treasury = await loadTreasuryState(config);
  const distributor = await loadDistributorState(config);
  const timelock = await loadTimelockState(config);
  const history = await loadHistory(config);

  return {
    addresses: config.addresses,
    rpcChainId,
    governance,
    treasury,
    distributor,
    timelock,
    history,
  };
}

async function loadGovernanceState(config) {
  const { rpcUrl, addresses } = config;
  const proposalCount = await callUint(rpcUrl, addresses.governanceGovernor, SELECTORS.proposalCount);
  const proposalThreshold = await callUint(
    rpcUrl,
    addresses.governanceGovernor,
    SELECTORS.proposalThreshold,
  );
  const votingDelay = await callUint(rpcUrl, addresses.governanceGovernor, SELECTORS.votingDelay);
  const votingPeriod = await callUint(rpcUrl, addresses.governanceGovernor, SELECTORS.votingPeriod);
  const quorumNumeratorBps = await callUint(
    rpcUrl,
    addresses.governanceGovernor,
    SELECTORS.quorumNumeratorBps,
  );
  const createdProposalLogs = await getLogs(rpcUrl, {
    address: addresses.governanceGovernor,
    fromBlock: "0x0",
    toBlock: "latest",
    topics: [[EVENT_TOPICS.governance.proposalCreated]],
  });
  const createdProposals = await Promise.all(
    createdProposalLogs.map((log) => decodeProposalCreatedLog(log, rpcUrl, addresses.governanceGovernor)),
  );

  createdProposals.sort((left, right) => right.proposalId - left.proposalId);

  return {
    tokenOwner: await callAddress(rpcUrl, addresses.governanceToken, SELECTORS.owner),
    tokenVotesDeployerReadable: true,
    governorAddress: addresses.governanceGovernor,
    timelockAddress: addresses.governanceTimelock,
    proposalCount,
    proposalThreshold,
    votingDelay,
    votingPeriod,
    quorumNumeratorBps,
    proposals: createdProposals,
  };
}

async function loadTreasuryState(config) {
  const { rpcUrl, addresses, trackedBuckets } = config;

  const owner = await callAddress(rpcUrl, addresses.treasury, SELECTORS.owner);
  const totalBalance = await callUint(
    rpcUrl,
    addresses.treasury,
    SELECTORS.totalBalance + encodeAddress(NATIVE_ASSET),
  );
  const operating = await callUint(
    rpcUrl,
    addresses.treasury,
    SELECTORS.classifiedBalance + encodeAddress(NATIVE_ASSET) + encodeUint(1n),
  );
  const distributable = await callUint(
    rpcUrl,
    addresses.treasury,
    SELECTORS.classifiedBalance + encodeAddress(NATIVE_ASSET) + encodeUint(2n),
  );
  const availableOperating = await callUint(
    rpcUrl,
    addresses.treasury,
    SELECTORS.availableOperatingBalance + encodeAddress(NATIVE_ASSET),
  );
  const unallocated = await callUint(
    rpcUrl,
    addresses.treasury,
    SELECTORS.unallocatedBalance + encodeAddress(NATIVE_ASSET),
  );

  const buckets = await Promise.all(
    trackedBuckets.map(async (bucket) => {
      try {
        const result = await callRaw(
          rpcUrl,
          addresses.treasury,
          SELECTORS.bucketStatus + encodeBytes32(bucket.id) + encodeAddress(NATIVE_ASSET),
        );

        return {
          ...bucket,
          status: "loaded",
          allocated: decodeUint(result, 0),
          spent: decodeUint(result, 1),
          remaining: decodeUint(result, 2),
        };
      } catch (error) {
        return {
          ...bucket,
          status: "error",
          error: toMessage(error),
        };
      }
    }),
  );

  return {
    owner,
    totalBalance,
    operating,
    distributable,
    availableOperating,
    unallocated,
    buckets,
  };
}

async function loadDistributorState(config) {
  const { rpcUrl, addresses, trackedDistributions } = config;

  const owner = await callAddress(rpcUrl, addresses.distributor, SELECTORS.owner);
  const totalOutstanding = await callUint(
    rpcUrl,
    addresses.distributor,
    SELECTORS.totalOutstandingForAsset + encodeAddress(NATIVE_ASSET),
  );

  const distributions = await Promise.all(
    trackedDistributions.map(async (distribution) => {
      try {
        const fundedAmount = await callUint(
          rpcUrl,
          addresses.distributor,
          SELECTORS.fundedAmount + encodeBytes32(distribution.id),
        );
        const state = await callRaw(
          rpcUrl,
          addresses.distributor,
          SELECTORS.distributionState + encodeBytes32(distribution.id),
        );

        return {
          ...distribution,
          status: "loaded",
          fundedAmount,
          asset: decodeAddress(state, 0),
          totalAmount: decodeUint(state, 1),
          claimedAmount: decodeUint(state, 3),
          stateCode: Number(decodeUint(state, 4)),
        };
      } catch (error) {
        return {
          ...distribution,
          status: "error",
          error: toMessage(error),
        };
      }
    }),
  );

  return {
    owner,
    totalOutstanding,
    distributions,
  };
}

async function loadTimelockState(config) {
  const { rpcUrl, addresses } = config;

  return {
    admin: await callAddress(rpcUrl, addresses.governanceTimelock, SELECTORS.admin),
    proposer: await callAddress(rpcUrl, addresses.governanceTimelock, SELECTORS.proposer),
    executor: await callAddress(rpcUrl, addresses.governanceTimelock, SELECTORS.executor),
    minDelay: await callUint(rpcUrl, addresses.governanceTimelock, SELECTORS.minDelay),
  };
}

async function loadHistory(config) {
  const historyConfig = config.history ?? { lookbackBlocks: 5000, maxItems: 24 };
  const latestBlockHex = await rpcRequest(config.rpcUrl, "eth_blockNumber");
  const latestBlockNumber = Number(BigInt(latestBlockHex));
  const lookbackBlocks = historyConfig.lookbackBlocks ?? 5000;
  const maxItems = historyConfig.maxItems ?? 24;
  const fromBlockNumber = Math.max(0, latestBlockNumber - lookbackBlocks + 1);
  const fromBlockHex = toBlockHex(fromBlockNumber);
  const toBlockHexValue = toBlockHex(latestBlockNumber);
  const blockCache = new Map();
  const bucketLabels = new Map(config.trackedBuckets.map((bucket) => [bucket.id.toLowerCase(), bucket.label]));
  const distributionLabels = new Map(
    config.trackedDistributions.map((distribution) => [distribution.id.toLowerCase(), distribution.label]),
  );

  const [treasuryLogs, distributorLogs, governanceLogs] = await Promise.all([
    getLogs(config.rpcUrl, {
      address: config.addresses.treasury,
      fromBlock: fromBlockHex,
      toBlock: toBlockHexValue,
      topics: [[
        EVENT_TOPICS.treasury.nativeReceived,
        EVENT_TOPICS.treasury.capitalClassified,
        EVENT_TOPICS.treasury.budgetAllocated,
        EVENT_TOPICS.treasury.budgetDeallocated,
        EVENT_TOPICS.treasury.bucketSpent,
      ]],
    }),
    getLogs(config.rpcUrl, {
      address: config.addresses.distributor,
      fromBlock: fromBlockHex,
      toBlock: toBlockHexValue,
      topics: [[
        EVENT_TOPICS.distributor.created,
        EVENT_TOPICS.distributor.funded,
        EVENT_TOPICS.distributor.claimed,
        EVENT_TOPICS.distributor.closed,
      ]],
    }),
    getLogs(config.rpcUrl, {
      address: config.addresses.governanceGovernor,
      fromBlock: fromBlockHex,
      toBlock: toBlockHexValue,
      topics: [[
        EVENT_TOPICS.governance.proposalCreated,
        EVENT_TOPICS.governance.voteCast,
        EVENT_TOPICS.governance.proposalQueued,
        EVENT_TOPICS.governance.proposalExecuted,
      ]],
    }),
  ]);

  const entries = await Promise.all(
    [...treasuryLogs, ...distributorLogs, ...governanceLogs]
      .map((log) => decodeHistoryLog(log, bucketLabels, distributionLabels))
      .filter((entry) => entry !== null)
      .map(async (entry) => ({
        ...entry,
        timestamp: await getBlockTimestamp(config.rpcUrl, entry.blockNumber, blockCache),
      })),
  );

  entries.sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) {
      return right.blockNumber - left.blockNumber;
    }

    return right.logIndex - left.logIndex;
  });

  return {
    latestBlockNumber,
    lookbackBlocks,
    maxItems,
    entries: entries.slice(0, maxItems),
  };
}

function decodeHistoryLog(log, bucketLabels, distributionLabels) {
  const topic0 = log.topics[0]?.toLowerCase();
  const blockNumber = Number(BigInt(log.blockNumber));
  const logIndex = Number(BigInt(log.logIndex));
  const txHash = log.transactionHash;

  if (topic0 === EVENT_TOPICS.treasury.nativeReceived) {
    const sender = decodeTopicAddress(log.topics[1]);
    const amount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "treasury",
      title: "Treasury funded",
      detail: `${shortenAddress(sender)} sent native capital into treasury custody.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.treasury.capitalClassified) {
    const classId = Number(decodeTopicUint(log.topics[2]));
    const amount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "treasury",
      title: "Capital classified",
      detail: `${capitalClassLabel(classId)} capital increased inside treasury policy accounting.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.treasury.budgetAllocated) {
    const bucketId = log.topics[1]?.toLowerCase();
    const amount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "treasury",
      title: "Budget allocated",
      detail: `${resolveLabel(bucketLabels, bucketId, "Bucket")} received operating budget allocation.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.treasury.budgetDeallocated) {
    const bucketId = log.topics[1]?.toLowerCase();
    const amount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "treasury",
      title: "Budget deallocated",
      detail: `${resolveLabel(bucketLabels, bucketId, "Bucket")} released operating budget back to available treasury capital.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.treasury.bucketSpent) {
    const bucketId = log.topics[1]?.toLowerCase();
    const recipient = decodeTopicAddress(log.topics[3]);
    const amount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "treasury",
      title: "Bucket spent",
      detail: `${resolveLabel(bucketLabels, bucketId, "Bucket")} paid ${shortenAddress(recipient)} from operating capital.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.distributor.created) {
    const distributionId = log.topics[1]?.toLowerCase();
    const totalAmount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "distribution",
      title: "Distribution created",
      detail: `${resolveLabel(distributionLabels, distributionId, "Distribution")} was opened for future funding and claims.`,
      amount: totalAmount,
    });
  }

  if (topic0 === EVENT_TOPICS.distributor.funded) {
    const distributionId = log.topics[1]?.toLowerCase();
    const amount = decodeUint(log.data, 0);
    const fundedAmount = decodeUint(log.data, 1);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "distribution",
      title: "Distribution funded",
      detail: `${resolveLabel(distributionLabels, distributionId, "Distribution")} received payout capital. Running funded total: ${formatEthCompact(fundedAmount)}.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.distributor.claimed) {
    const distributionId = log.topics[1]?.toLowerCase();
    const recipient = decodeTopicAddress(log.topics[2]);
    const amount = decodeUint(log.data, 0);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "distribution",
      title: "Distribution claimed",
      detail: `${shortenAddress(recipient)} claimed from ${resolveLabel(distributionLabels, distributionId, "Distribution")}.`,
      amount,
    });
  }

  if (topic0 === EVENT_TOPICS.distributor.closed) {
    const distributionId = log.topics[1]?.toLowerCase();
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "distribution",
      title: "Distribution closed",
      detail: `${resolveLabel(distributionLabels, distributionId, "Distribution")} is no longer claimable.`,
    });
  }

  if (topic0 === EVENT_TOPICS.governance.proposalCreated) {
    const proposalId = decodeTopicUint(log.topics[1]).toString();
    const target = decodeTopicAddress(log.topics[3]);
    const value = decodeUint(log.data, 0);
    const description = decodeDynamicString(log.data, 3);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "governance",
      title: `Proposal #${proposalId} created`,
      detail: description.length > 0
        ? `${description} Target: ${shortenAddress(target)}.`
        : `Proposal targeted ${shortenAddress(target)} for governed execution.`,
      amount: value > 0n ? value : undefined,
    });
  }

  if (topic0 === EVENT_TOPICS.governance.voteCast) {
    const proposalId = decodeTopicUint(log.topics[2]).toString();
    const voter = decodeTopicAddress(log.topics[1]);
    const support = Number(decodeUint(log.data, 0));
    const weight = decodeUint(log.data, 1);
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "governance",
      title: `Vote cast on proposal #${proposalId}`,
      detail: `${shortenAddress(voter)} voted ${voteSupportLabel(support)} with ${formatTokenCompact(weight)} voting power.`,
    });
  }

  if (topic0 === EVENT_TOPICS.governance.proposalQueued) {
    const proposalId = decodeTopicUint(log.topics[1]).toString();
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "governance",
      title: `Proposal #${proposalId} queued`,
      detail: "The proposal moved from voting success into the timelock execution queue.",
    });
  }

  if (topic0 === EVENT_TOPICS.governance.proposalExecuted) {
    const proposalId = decodeTopicUint(log.topics[1]).toString();
    return buildHistoryEntry({
      id: `${txHash}-${logIndex}`,
      blockNumber,
      logIndex,
      txHash,
      category: "governance",
      title: `Proposal #${proposalId} executed`,
      detail: "The timelocked governance action completed on-chain.",
    });
  }

  return null;
}

async function decodeProposalCreatedLog(log, rpcUrl, governorAddress) {
  const proposalId = Number(decodeTopicUint(log.topics[1]));
  const proposer = decodeTopicAddress(log.topics[2]);
  const target = decodeTopicAddress(log.topics[3]);
  const value = decodeUint(log.data, 0);
  const snapshot = decodeUint(log.data, 1);
  const deadline = decodeUint(log.data, 2);
  const description = decodeDynamicString(log.data, 3);
  const [stateCode, voteData] = await Promise.all([
    callUint(rpcUrl, governorAddress, SELECTORS.governorState + encodeUint(proposalId)),
    callRaw(rpcUrl, governorAddress, SELECTORS.proposalVotes + encodeUint(proposalId)),
  ]);

  return {
    proposalId,
    proposer,
    target,
    value,
    snapshot,
    deadline,
    description,
    stateCode: Number(stateCode),
    againstVotes: decodeUint(voteData, 0),
    forVotes: decodeUint(voteData, 1),
    abstainVotes: decodeUint(voteData, 2),
    transactionHash: log.transactionHash,
    blockNumber: Number(BigInt(log.blockNumber)),
  };
}

function buildHistoryEntry(entry) {
  return {
    timestamp: null,
    amount: undefined,
    ...entry,
  };
}

async function getBlockTimestamp(rpcUrl, blockNumber, blockCache) {
  if (blockCache.has(blockNumber)) {
    return blockCache.get(blockNumber);
  }

  const block = await rpcRequest(rpcUrl, "eth_getBlockByNumber", [
    toBlockHex(blockNumber),
    false,
  ]);
  const timestamp = Number(BigInt(block.timestamp));
  blockCache.set(blockNumber, timestamp);
  return timestamp;
}

async function getLogs(rpcUrl, filter) {
  return rpcRequest(rpcUrl, "eth_getLogs", [filter]);
}

async function callAddress(rpcUrl, to, data) {
  return decodeAddress(await callRaw(rpcUrl, to, data), 0);
}

async function callUint(rpcUrl, to, data) {
  return decodeUint(await callRaw(rpcUrl, to, data), 0);
}

async function callRaw(rpcUrl, to, data) {
  return rpcRequest(rpcUrl, "eth_call", [
    {
      to,
      data,
    },
    "latest",
  ]);
}

export async function rpcRequest(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.error !== undefined) {
    throw new Error(payload.error.message ?? "RPC call failed.");
  }

  return payload.result;
}

export async function readTokenVotes(rpcUrl, tokenAddress, account) {
  if (account === null || account === undefined) {
    return 0n;
  }

  return callUint(rpcUrl, tokenAddress, SELECTORS.getVotes + encodeAddress(account));
}

function decodeUint(data, index) {
  const slot = readSlot(data, index);
  return BigInt(`0x${slot}`);
}

function decodeAddress(data, index) {
  const slot = readSlot(data, index);
  return `0x${slot.slice(24)}`;
}

function decodeTopicAddress(topic) {
  return `0x${normalizeHexLength(topic, 64).slice(24)}`;
}

function decodeTopicUint(topic) {
  return BigInt(`0x${normalizeHexLength(topic, 64)}`);
}

function decodeDynamicString(data, offsetSlotIndex) {
  const offsetBytes = Number(decodeUint(data, offsetSlotIndex));
  const baseIndex = offsetBytes / 32;
  const length = Number(decodeUint(data, baseIndex));
  const normalized = stripHexPrefix(data);
  const start = (baseIndex + 1) * 64;
  const end = start + length * 2;
  const hex = normalized.slice(start, end);

  if (hex.length === 0) {
    return "";
  }

  let result = "";
  for (let index = 0; index < hex.length; index += 2) {
    result += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
  }

  return result;
}

function readSlot(data, index) {
  const normalized = stripHexPrefix(data);
  return normalized.slice(index * 64, (index + 1) * 64);
}

function encodeAddress(address) {
  return normalizeHexLength(address, 40).padStart(64, "0");
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeBytes32(value) {
  return normalizeHexLength(value, 64);
}

function normalizeHexLength(value, expectedLength) {
  const normalized = stripHexPrefix(value).toLowerCase();

  if (normalized.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength / 2} bytes of hex data.`);
  }

  return normalized;
}

function stripHexPrefix(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function toBlockHex(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function resolveLabel(labelMap, id, fallback) {
  return labelMap.get(id ?? "") ?? `${fallback} ${shortenHex(id)}`;
}

function capitalClassLabel(classId) {
  if (classId === 1) {
    return "Operating";
  }
  if (classId === 2) {
    return "Distributable";
  }

  return `Class ${classId}`;
}

function voteSupportLabel(support) {
  if (support === 0) {
    return "Against";
  }
  if (support === 1) {
    return "For";
  }
  if (support === 2) {
    return "Abstain";
  }

  return `Support ${support}`;
}

function formatEthCompact(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0");
  const trimmedFraction = fraction.replace(/0+$/, "").slice(0, 3);

  return trimmedFraction.length === 0
    ? `${whole.toString()} ETH`
    : `${whole.toString()}.${trimmedFraction} ETH`;
}

function formatTokenCompact(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0");
  const trimmedFraction = fraction.replace(/0+$/, "").slice(0, 3);

  return trimmedFraction.length === 0
    ? `${whole.toString()} votes`
    : `${whole.toString()}.${trimmedFraction} votes`;
}

function shortenAddress(address) {
  if (address === undefined || address === null || address.length < 12) {
    return "Unknown";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenHex(value) {
  if (value === undefined || value === null || value.length < 12) {
    return "unknown";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function getNativeAssetAddress() {
  return NATIVE_ASSET;
}
