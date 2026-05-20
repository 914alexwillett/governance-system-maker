export type DeployPresetKey =
  | "local-demo"
  | "testnet-demo"
  | "conservative-governance";

export interface DeployV3Config {
  preset: {
    key: DeployPresetKey;
    label: string;
    useWhen: string;
    notes: string[];
  };
  network: {
    label: string;
    explorerBaseUrl?: string;
    requiredEnvVars?: string[];
  };
  token: {
    name: string;
    symbol: string;
    initialSupply: bigint;
    selfDelegateInitialVotes: boolean;
  };
  timelock: {
    minDelay: bigint;
    selfAdminAfterBootstrap: boolean;
  };
  governor: {
    name: string;
    votingDelay: bigint;
    votingPeriod: bigint;
    proposalThreshold: bigint;
    quorumNumeratorBps: bigint;
  };
  assumptions: {
    treasury: string[];
    distributor: string[];
  };
}

type DeployPresetTemplate = Omit<DeployV3Config, "network">;

const sharedAssumptions = {
  treasury: [
    "Treasury deploys with the bootstrap deployer as the initial owner, then ownership is expected to move to the timelock.",
    "Treasury starts as a custody and accounting module only. It does not receive seeded capital automatically at deploy time.",
    "Operating bucket behavior is available immediately after deployment, but treasury actions are intended to flow through governance after handoff.",
  ],
  distributor: [
    "Distributor deploys with the bootstrap deployer as the initial owner, then ownership is expected to move to the timelock.",
    "Distributor starts with no distributions and no funded liabilities until explicit setup actions occur later.",
    "The current MVP claim model is self-claim based. Off-chain proof tooling is explanatory and future-compatible, not on-chain enforced today.",
  ],
} satisfies DeployV3Config["assumptions"];

const presetTemplates: Record<DeployPresetKey, DeployPresetTemplate> = {
  "local-demo": {
    preset: {
      key: "local-demo",
      label: "Local Demo",
      useWhen:
        "Use for local chain rehearsals, seeded demos, and fast iteration on ownership and governance flow.",
      notes: [
        "Keeps governance timing short enough for local walkthroughs.",
        "Matches the current seeded demo and most Node-test assumptions.",
      ],
    },
    token: {
      name: "Governance Capital Token",
      symbol: "GOVCAP",
      initialSupply: 1_000_000n * 10n ** 18n,
      selfDelegateInitialVotes: true,
    },
    timelock: {
      minDelay: 3_600n,
      selfAdminAfterBootstrap: true,
    },
    governor: {
      name: "Governance Capital Governor",
      votingDelay: 1n,
      votingPeriod: 50n,
      proposalThreshold: 10_000n * 10n ** 18n,
      quorumNumeratorBps: 1_000n,
    },
    assumptions: sharedAssumptions,
  },
  "testnet-demo": {
    preset: {
      key: "testnet-demo",
      label: "Testnet Demo",
      useWhen:
        "Use for a real public testnet deployment when you want realistic but still MVP-friendly governance timing.",
      notes: [
        "Extends voting and timelock timing compared with the local demo preset.",
        "Still keeps the single bootstrap deployer and timelock handoff model.",
      ],
    },
    token: {
      name: "Governance Capital Token",
      symbol: "GOVCAP",
      initialSupply: 1_000_000n * 10n ** 18n,
      selfDelegateInitialVotes: true,
    },
    timelock: {
      minDelay: 86_400n,
      selfAdminAfterBootstrap: true,
    },
    governor: {
      name: "Governance Capital Governor",
      votingDelay: 1n,
      votingPeriod: 7_200n,
      proposalThreshold: 10_000n * 10n ** 18n,
      quorumNumeratorBps: 1_000n,
    },
    assumptions: sharedAssumptions,
  },
  "conservative-governance": {
    preset: {
      key: "conservative-governance",
      label: "Conservative Governance",
      useWhen:
        "Use when you want a more cautious governance posture without changing the underlying MVP module architecture.",
      notes: [
        "Raises time buffers and participation requirements compared with the demo presets.",
        "Still uses the same deployer-first bootstrap and timelock handoff sequence.",
      ],
    },
    token: {
      name: "Governance Capital Token",
      symbol: "GOVCAP",
      initialSupply: 1_000_000n * 10n ** 18n,
      selfDelegateInitialVotes: true,
    },
    timelock: {
      minDelay: 172_800n,
      selfAdminAfterBootstrap: true,
    },
    governor: {
      name: "Governance Capital Governor",
      votingDelay: 20n,
      votingPeriod: 14_400n,
      proposalThreshold: 25_000n * 10n ** 18n,
      quorumNumeratorBps: 1_500n,
    },
    assumptions: sharedAssumptions,
  },
};

const networkMetadata = {
  default: {
    label: "Local Hardhat Mainnet",
  },
  hardhatMainnet: {
    label: "Local Hardhat Mainnet",
  },
  localhost: {
    label: "Localhost JSON-RPC",
  },
  sepolia: {
    label: "Ethereum Sepolia",
    explorerBaseUrl: "https://sepolia.etherscan.io",
    requiredEnvVars: ["SEPOLIA_RPC_URL", "SEPOLIA_PRIVATE_KEY"],
  },
} satisfies Record<string, DeployV3Config["network"]>;

const defaultPresetByNetwork = {
  default: "local-demo",
  hardhatMainnet: "local-demo",
  localhost: "local-demo",
  sepolia: "testnet-demo",
} satisfies Record<string, DeployPresetKey>;

export function getDeployV3Config(
  networkName: string,
  presetOverride?: string,
): DeployV3Config {
  const resolvedPresetKey = resolvePresetKey(networkName, presetOverride);
  const preset = presetTemplates[resolvedPresetKey];
  const network = networkMetadata[networkName] ?? networkMetadata.default;

  return {
    ...preset,
    network,
  };
}

export function listDeployPresets() {
  return Object.values(presetTemplates).map((preset) => ({
    key: preset.preset.key,
    label: preset.preset.label,
    useWhen: preset.preset.useWhen,
    notes: preset.preset.notes,
    token: {
      name: preset.token.name,
      symbol: preset.token.symbol,
      initialSupply: preset.token.initialSupply.toString(),
      selfDelegateInitialVotes: preset.token.selfDelegateInitialVotes,
    },
    timelock: {
      minDelay: preset.timelock.minDelay.toString(),
      selfAdminAfterBootstrap: preset.timelock.selfAdminAfterBootstrap,
    },
    governor: {
      name: preset.governor.name,
      votingDelay: preset.governor.votingDelay.toString(),
      votingPeriod: preset.governor.votingPeriod.toString(),
      proposalThreshold: preset.governor.proposalThreshold.toString(),
      quorumNumeratorBps: preset.governor.quorumNumeratorBps.toString(),
    },
  }));
}

export function getDefaultDeployPresetForNetwork(networkName: string): DeployPresetKey {
  return defaultPresetByNetwork[networkName] ?? defaultPresetByNetwork.default;
}

export function resolvePresetKey(
  networkName: string,
  presetOverride?: string,
): DeployPresetKey {
  const candidate = (
    presetOverride ??
    process.env.GOVCAP_DEPLOY_PRESET ??
    getDefaultDeployPresetForNetwork(networkName)
  ).trim() as DeployPresetKey;

  if (!(candidate in presetTemplates)) {
    throw new Error(
      `Unknown deployment preset "${candidate}". Supported presets: ${Object.keys(presetTemplates).join(", ")}.`,
    );
  }

  return candidate;
}
