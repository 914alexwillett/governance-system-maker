export interface DeployV3Config {
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
}

const sharedConfig: DeployV3Config = {
  network: {
    label: "Local Hardhat Mainnet",
  },
  token: {
    name: "Governance Capital Token",
    symbol: "GOVCAP",
    initialSupply: 1_000_000n * 10n ** 18n,
    selfDelegateInitialVotes: true,
  },
  timelock: {
    minDelay: 3600n,
    selfAdminAfterBootstrap: true,
  },
  governor: {
    name: "Governance Capital Governor",
    votingDelay: 1n,
    votingPeriod: 50n,
    proposalThreshold: 10_000n * 10n ** 18n,
    quorumNumeratorBps: 1_000n,
  },
};

const networkConfigs: Record<string, DeployV3Config> = {
  default: sharedConfig,
  hardhatMainnet: sharedConfig,
  localhost: {
    ...sharedConfig,
    network: {
      label: "Localhost JSON-RPC",
    },
  },
  sepolia: {
    ...sharedConfig,
    network: {
      label: "Ethereum Sepolia",
      explorerBaseUrl: "https://sepolia.etherscan.io",
      requiredEnvVars: ["SEPOLIA_RPC_URL", "SEPOLIA_PRIVATE_KEY"],
    },
    timelock: {
      ...sharedConfig.timelock,
      minDelay: 86_400n,
    },
    governor: {
      ...sharedConfig.governor,
      votingPeriod: 7_200n,
    },
  },
};

export function getDeployV3Config(networkName: string): DeployV3Config {
  return networkConfigs[networkName] ?? networkConfigs.default;
}
