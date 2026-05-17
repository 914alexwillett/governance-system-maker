const CLAIM_SELECTOR = "0x4b2667f2";
const GOVERNOR_PROPOSE_SELECTOR = "0x82ff16c1";
const GOVERNOR_CAST_VOTE_SELECTOR = "0x56781388";
const GOVERNOR_QUEUE_SELECTOR = "0xddf0b009";
const GOVERNOR_EXECUTE_SELECTOR = "0xfe0d94c1";

export function getWalletProvider() {
  return window.ethereum;
}

export async function getWalletState() {
  const provider = getWalletProvider();

  if (provider === undefined) {
    return {
      available: false,
      account: null,
      chainId: null,
    };
  }

  const [account] = await provider.request({ method: "eth_accounts" });
  const chainId = await provider.request({ method: "eth_chainId" });

  return {
    available: true,
    account: account ?? null,
    chainId,
  };
}

export async function connectWallet() {
  const provider = requireProvider();
  const [account] = await provider.request({ method: "eth_requestAccounts" });
  const chainId = await provider.request({ method: "eth_chainId" });

  return {
    available: true,
    account,
    chainId,
  };
}

export function watchWalletChanges(onChange) {
  const provider = getWalletProvider();

  if (provider === undefined || typeof provider.on !== "function") {
    return;
  }

  provider.on("accountsChanged", onChange);
  provider.on("chainChanged", onChange);
}

export async function ensureWalletOnChain(chainIdHex, rpcUrl) {
  const provider = requireProvider();
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (normalizeHex(currentChainId) === normalizeHex(chainIdHex)) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    if (isUnknownChainError(error)) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chainIdHex,
          chainName: networkLabel(chainIdHex),
          nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
          },
          rpcUrls: [rpcUrl],
        }],
      });
      return;
    }

    throw error;
  }
}

export async function fundTreasury({
  treasuryAddress,
  amountWei,
}) {
  const provider = requireProvider();
  const from = await requireAccount(provider);

  return provider.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to: treasuryAddress,
      value: toQuantity(amountWei),
    }],
  });
}

export async function claimDistribution({
  distributorAddress,
  distributionId,
  recipient,
  amountWei,
}) {
  const provider = requireProvider();
  const from = await requireAccount(provider);

  return provider.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to: distributorAddress,
      data: encodeClaimCalldata(distributionId, recipient, amountWei),
    }],
  });
}

export async function createGovernanceProposal({
  governorAddress,
  target,
  value = 0n,
  data,
  description,
}) {
  return sendContractTransaction(
    governorAddress,
    encodeProposeCalldata(target, value, data, description),
  );
}

export async function castGovernanceVote({
  governorAddress,
  proposalId,
  support,
}) {
  return sendContractTransaction(
    governorAddress,
    GOVERNOR_CAST_VOTE_SELECTOR + encodeUint(proposalId) + encodeUint(support),
  );
}

export async function queueGovernanceProposal({
  governorAddress,
  proposalId,
}) {
  return sendContractTransaction(
    governorAddress,
    GOVERNOR_QUEUE_SELECTOR + encodeUint(proposalId),
  );
}

export async function executeGovernanceProposal({
  governorAddress,
  proposalId,
}) {
  return sendContractTransaction(
    governorAddress,
    GOVERNOR_EXECUTE_SELECTOR + encodeUint(proposalId),
  );
}

export async function waitForTransactionReceipt(txHash) {
  const provider = requireProvider();

  while (true) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (receipt !== null) {
      return receipt;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 1500);
    });
  }
}

export function parseEthAmount(value) {
  const normalized = value.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Enter a valid ETH amount.");
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const whole = BigInt(wholePart || "0") * 10n ** 18n;
  const fraction = BigInt((fractionPart + "0".repeat(18)).slice(0, 18));

  return whole + fraction;
}

export function shortenAddress(address) {
  if (address === null || address === undefined || address.length < 12) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function chainLabel(chainIdHex) {
  if (chainIdHex === null) {
    return "Unknown";
  }

  const normalized = normalizeHex(chainIdHex);

  if (normalized === "0x7a69") {
    return "Hardhat Localhost";
  }
  if (normalized === "0xaa36a7") {
    return "Sepolia";
  }

  return `Chain ${normalized}`;
}

export function encodeTreasuryClassifyCapital({ amountWei }) {
  return (
    "0xe2da1324" +
    encodeAddress("0x0000000000000000000000000000000000000000") +
    encodeUint(1n) +
    encodeUint(amountWei)
  );
}

export function encodeTreasuryAllocateBudget({ bucketId, amountWei }) {
  return (
    "0xfc8ae919" +
    encodeBytes32(bucketId) +
    encodeAddress("0x0000000000000000000000000000000000000000") +
    encodeUint(amountWei)
  );
}

export function encodeTreasurySpend({ bucketId, recipient, amountWei }) {
  return (
    "0x9fd832f1" +
    encodeBytes32(bucketId) +
    encodeAddress("0x0000000000000000000000000000000000000000") +
    encodeAddress(recipient) +
    encodeUint(amountWei)
  );
}

export function encodeDistributorCreateDistribution({ distributionId, amountWei }) {
  return (
    "0xae8427bd" +
    encodeBytes32(distributionId) +
    encodeAddress("0x0000000000000000000000000000000000000000") +
    encodeUint(amountWei)
  );
}

function encodeClaimCalldata(distributionId, recipient, amountWei) {
  return (
    CLAIM_SELECTOR +
    encodeBytes32(distributionId) +
    encodeAddress(recipient) +
    encodeUint(amountWei)
  );
}

function encodeProposeCalldata(target, value, data, description) {
  const normalizedData = normalizeDynamicBytes(data);
  const normalizedDescription = stringToHexString(description);
  const bytesOffset = 128n;
  const bytesSectionLength = BigInt(64 + padHexLength(normalizedData.length));
  const descriptionOffset = bytesOffset + (bytesSectionLength / 2n);

  return (
    GOVERNOR_PROPOSE_SELECTOR +
    encodeAddress(target) +
    encodeUint(value) +
    encodeUint(bytesOffset) +
    encodeUint(descriptionOffset) +
    encodeDynamicBytes(normalizedData) +
    encodeDynamicBytes(normalizedDescription)
  );
}

function encodeAddress(address) {
  return normalizeHex(address).replace(/^0x/, "").padStart(64, "0");
}

function encodeBytes32(value) {
  const normalized = normalizeHex(value).replace(/^0x/, "");

  if (normalized.length !== 64) {
    throw new Error("Expected a bytes32 value.");
  }

  return normalized;
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeDynamicBytes(value) {
  const normalized = normalizeDynamicBytes(value);
  return encodeUint(normalized.length / 2) + normalized.padEnd(padHexLength(normalized.length), "0");
}

function toQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

async function sendContractTransaction(to, data) {
  const provider = requireProvider();
  const from = await requireAccount(provider);

  return provider.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to,
      data,
    }],
  });
}

async function requireAccount(provider) {
  const [account] = await provider.request({ method: "eth_accounts" });

  if (account === undefined) {
    throw new Error("Connect a wallet before sending a transaction.");
  }

  return account;
}

function requireProvider() {
  const provider = getWalletProvider();

  if (provider === undefined) {
    throw new Error("No wallet provider was found in this browser.");
  }

  return provider;
}

function networkLabel(chainIdHex) {
  if (normalizeHex(chainIdHex) === "0x7a69") {
    return "Hardhat Localhost";
  }
  if (normalizeHex(chainIdHex) === "0xaa36a7") {
    return "Ethereum Sepolia";
  }

  return "Configured Demo Network";
}

function isUnknownChainError(error) {
  return error?.code === 4902 || String(error?.message ?? "").includes("4902");
}

function normalizeHex(value) {
  return value.toLowerCase();
}

function normalizeDynamicBytes(value) {
  return normalizeHex(value).replace(/^0x/, "");
}

function stringToHexString(value) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function padHexLength(length) {
  return Math.ceil(length / 64) * 64;
}
