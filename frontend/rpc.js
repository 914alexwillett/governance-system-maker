const SELECTORS = {
  owner: "0x8da5cb5b",
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
};

const NATIVE_ASSET = "0x0000000000000000000000000000000000000000";

export async function loadDashboardState(config) {
  const treasury = await loadTreasuryState(config);
  const distributor = await loadDistributorState(config);
  const timelock = await loadTimelockState(config);

  return {
    addresses: config.addresses,
    treasury,
    distributor,
    timelock,
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

async function callAddress(rpcUrl, to, data) {
  return decodeAddress(await callRaw(rpcUrl, to, data), 0);
}

async function callUint(rpcUrl, to, data) {
  return decodeUint(await callRaw(rpcUrl, to, data), 0);
}

async function callRaw(rpcUrl, to, data) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_call",
      params: [
        {
          to,
          data,
        },
        "latest",
      ],
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

function decodeUint(data, index) {
  const slot = readSlot(data, index);
  return BigInt(`0x${slot}`);
}

function decodeAddress(data, index) {
  const slot = readSlot(data, index);
  return `0x${slot.slice(24)}`;
}

function readSlot(data, index) {
  const normalized = data.startsWith("0x") ? data.slice(2) : data;
  return normalized.slice(index * 64, (index + 1) * 64);
}

function encodeAddress(address) {
  return normalizeHex(address, 40).padStart(64, "0");
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeBytes32(value) {
  return normalizeHex(value, 64);
}

function normalizeHex(value, expectedLength) {
  const normalized = value.toLowerCase().replace(/^0x/, "");

  if (normalized.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength / 2} bytes of hex data.`);
  }

  return normalized;
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function getNativeAssetAddress() {
  return NATIVE_ASSET;
}
