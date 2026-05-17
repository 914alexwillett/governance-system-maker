export const deploymentProfiles = {
  localhost: {
    label: "Localhost JSON-RPC",
    networkName: "localhost",
    deployMode: "persistent-local",
    command: "npx hardhat run scripts/deploy-v3.ts --build-profile production --network localhost",
    requiredEnvVars: [],
    notes: [
      "Use this with a persistent local node such as `npm run chain:dev`.",
      "This is the best profile for rehearsing a product launch flow without spending testnet funds.",
    ],
    recommended: {
      timelockDelayHours: "1",
      votingDelayBlocks: "1",
      votingPeriodBlocks: "50",
      proposalThresholdTokens: "10000",
      quorumNumeratorBps: "1000",
    },
  },
  sepolia: {
    label: "Ethereum Sepolia",
    networkName: "sepolia",
    deployMode: "testnet",
    command: "npx hardhat run scripts/deploy-v3.ts --build-profile production --network sepolia",
    requiredEnvVars: ["SEPOLIA_RPC_URL", "SEPOLIA_PRIVATE_KEY"],
    notes: [
      "This profile maps to the current real testnet deployment path.",
      "The current deploy flow is still bootstrap-admin first, then handoff to the timelock.",
    ],
    recommended: {
      timelockDelayHours: "24",
      votingDelayBlocks: "1",
      votingPeriodBlocks: "7200",
      proposalThresholdTokens: "10000",
      quorumNumeratorBps: "1000",
    },
  },
};

export const deployerDefaults = {
  systemLabel: "Community Treasury Launch",
  networkProfile: "localhost",
  tokenName: "Governance Capital Token",
  tokenSymbol: "GOVCAP",
  initialSupplyTokens: "1000000",
  governorName: "Governance Capital Governor",
  timelockDelayHours: deploymentProfiles.localhost.recommended.timelockDelayHours,
  selfDelegateInitialVotes: true,
  selfAdminAfterBootstrap: true,
};

export const deploymentBlueprint = [
  {
    key: "governanceToken",
    label: "GovernanceToken",
    purpose: "Creates the governance voting supply and delegation checkpoints.",
  },
  {
    key: "treasury",
    label: "Treasury",
    purpose: "Custodies capital, classifications, and operating bucket balances.",
  },
  {
    key: "distributor",
    label: "Distributor",
    purpose: "Holds funded payout events and recipient claim accounting.",
  },
  {
    key: "governanceTimelock",
    label: "GovernanceTimelock",
    purpose: "Becomes the delayed execution owner for governed modules after handoff.",
  },
  {
    key: "governanceGovernor",
    label: "GovernanceGovernor",
    purpose: "Uses token voting power and routes approved actions through the timelock.",
  },
];
