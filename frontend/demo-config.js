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
  history: {
    lookbackBlocks: 5000,
    maxItems: 24,
  },
};
