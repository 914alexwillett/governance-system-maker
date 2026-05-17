const CLAIM_SELECTOR = "0x4b2667f2";

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

function encodeClaimCalldata(distributionId, recipient, amountWei) {
  return (
    CLAIM_SELECTOR +
    encodeBytes32(distributionId) +
    encodeAddress(recipient) +
    encodeUint(amountWei)
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

function toQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
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
