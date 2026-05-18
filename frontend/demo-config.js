export const demoDefaults = {
  rpcUrl: "http://127.0.0.1:8545",
  addresses: {
    governanceToken: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    treasury: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    distributor: "0x9fE46736679d2d9a65F0992F2272dE9f3c7fa6e0",
    governanceTimelock: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    governanceGovernor: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  },
  trackedBuckets: [
    {
      id: "0x4444444444444444444444444444444444444444444444444444444444444444",
      label: "Demo operating bucket",
    },
  ],
  trackedDistributions: [
    {
      id: "0x1b3324529b327ceddbe414fa4509bb102c7724d9e0782a4b8e38fbc8529f6dc3",
      label: "Demo community grant",
    },
  ],
  demoActors: [
    {
      role: "Bootstrap admin",
      walletIndex: 0,
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      story: "Initial deployer and bootstrap governance actor.",
    },
    {
      role: "Governance participant",
      walletIndex: 1,
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      story: "Secondary governance user seeded with delegated voting power.",
    },
    {
      role: "Treasury recipient",
      walletIndex: 2,
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      story: "Recipient of the seeded operating spend.",
    },
    {
      role: "Distribution claimant",
      walletIndex: 3,
      address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      story: "Suggested claimant for the seeded distribution demo.",
    },
    {
      role: "Viewer",
      walletIndex: 4,
      address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      story: "Optional read-first account for observing state without driving the main seeded actions.",
    },
  ],
  history: {
    lookbackBlocks: 5000,
    maxItems: 24,
  },
};
