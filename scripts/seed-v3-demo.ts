import { network } from "hardhat";
import type { Address, Hex } from "viem";
import {
  encodeFunctionData,
  getAddress,
} from "viem";

import { getDeployV3Config } from "./config/deploy-v3.js";
import {
  getSeedV3DemoConfig,
  type SeedV3DeploymentAddresses,
} from "./config/seed-v3-demo.js";
import { buildDistributionClaimArtifact } from "./config/distributor-claim-tooling.js";

const { networkName, viem, networkHelpers } = await network.create();
const publicClient = await viem.getPublicClient();
const [deployer, governanceParticipant, operationsRecipient, distributionRecipient, viewer] =
  await viem.getWalletClients();

if (
  deployer.account === undefined ||
  governanceParticipant.account === undefined ||
  operationsRecipient.account === undefined ||
  distributionRecipient.account === undefined ||
  viewer?.account === undefined
) {
  throw new Error("Expected default wallet clients for the local demo seed.");
}

const deployerAddress = getAddress(deployer.account.address);
const governanceParticipantAddress = getAddress(
  governanceParticipant.account.address,
);
const operationsRecipientAddress = getAddress(operationsRecipient.account.address);
const distributionRecipientAddress = getAddress(
  distributionRecipient.account.address,
);
const viewerAddress = getAddress(viewer.account.address);

const deployConfig = getDeployV3Config(networkName);
const demoConfig = getSeedV3DemoConfig(networkName);

console.log(`Seeding Governance Capital MVP demo on ${networkName}`);
console.log(`Bootstrap actor: ${deployerAddress}`);

const deployed = demoConfig.deploymentAddresses === undefined
  ? await deployFreshLocalStack()
  : await loadDeployedContracts(demoConfig.deploymentAddresses);

const delegatedVotes = await deployed.governanceToken.read.getVotes([
  deployerAddress,
]);

if (delegatedVotes < deployConfig.governor.proposalThreshold) {
  throw new Error(
    "The bootstrap actor does not have enough delegated voting power to seed the governed demo flow.",
  );
}

console.log("");
console.log("Preparing demo identities");
console.log("=========================");

await waitForTransaction(
  deployed.governanceToken.write.transfer([
    governanceParticipantAddress,
    demoConfig.governanceParticipantTokenAllocation,
  ]),
);

const governanceParticipantToken = await viem.getContractAt(
  "GovernanceToken",
  deployed.governanceToken.address,
  { client: { wallet: governanceParticipant } },
);

await waitForTransaction(
  governanceParticipantToken.write.delegate([governanceParticipantAddress]),
);

const governanceParticipantVotes = await deployed.governanceToken.read.getVotes([
  governanceParticipantAddress,
]);

console.log(
  `Governance participant funded with ${formatEth(demoConfig.governanceParticipantTokenAllocation)} GOV and self-delegated to ${formatEth(governanceParticipantVotes)} votes.`,
);

console.log("");
console.log("Funding custody");
console.log("===============");

await waitForTransaction(
  deployer.sendTransaction({
    to: deployed.treasury.address,
    value: demoConfig.treasuryFunding,
  }),
);
console.log(
  `Treasury funded with ${formatEth(demoConfig.treasuryFunding)} ETH of demo capital.`,
);

await waitForTransaction(
  deployer.sendTransaction({
    to: deployed.governanceTimelock.address,
    value: demoConfig.timelockFunding,
  }),
);
console.log(
  `Timelock funded with ${formatEth(demoConfig.timelockFunding)} ETH for governed distributor funding.`,
);

console.log("");
console.log("Governed demo flow");
console.log("==================");

await executeGovernanceAction({
  target: deployed.treasury.address,
  data: encodeFunctionData({
    abi: deployed.treasury.abi,
    functionName: "classifyCapital",
    args: [zeroAddress(), 1, demoConfig.operatingClassification],
  }),
  description: "Classify operating capital for the local demo",
});

await executeGovernanceAction({
  target: deployed.treasury.address,
  data: encodeFunctionData({
    abi: deployed.treasury.abi,
    functionName: "allocateBudget",
    args: [
      {
        bucketId: demoConfig.operationsBucketId,
        asset: zeroAddress(),
        amount: demoConfig.operatingBucketAllocation,
      },
    ],
  }),
  description: "Allocate the demo operating budget bucket",
});

await executeGovernanceAction({
  target: deployed.treasury.address,
  data: encodeFunctionData({
    abi: deployed.treasury.abi,
    functionName: "spend",
    args: [
      {
        bucketId: demoConfig.operationsBucketId,
        asset: zeroAddress(),
        recipient: operationsRecipientAddress,
        amount: demoConfig.operatingSpendAmount,
      },
    ],
  }),
  description: "Spend a portion of the demo operating budget",
});

await executeGovernanceAction({
  target: deployed.distributor.address,
  data: encodeFunctionData({
    abi: deployed.distributor.abi,
    functionName: "createDistribution",
    args: [
      {
        distributionId: demoConfig.distributionId,
        asset: zeroAddress(),
        totalAmount: demoConfig.distributionFunding,
      },
    ],
  }),
  description: "Create the demo community distribution event",
});

await executeGovernanceAction({
  target: deployed.distributor.address,
  value: demoConfig.distributionFunding,
  data: encodeFunctionData({
    abi: deployed.distributor.abi,
    functionName: "fundDistribution",
    args: [demoConfig.distributionId, demoConfig.distributionFunding],
  }),
  description: "Fund the demo community distribution event",
});

const [bucketAllocated, bucketSpent, bucketRemaining] =
  await deployed.treasury.read.bucketStatus([
    demoConfig.operationsBucketId,
    zeroAddress(),
  ]);

const distributionState = await deployed.distributor.read.distributionState([
  demoConfig.distributionId,
]);
const claimArtifact = buildDistributionClaimArtifact({
  distributionId: demoConfig.distributionId,
  distributionLabel: demoConfig.distributionLabel,
  asset: zeroAddress(),
  totalAmount: demoConfig.distributionFunding,
  claims: [
    {
      label: "Seeded distribution claimant",
      recipient: distributionRecipientAddress,
      amount: demoConfig.distributionFunding,
      note: "Suggested claimant for the local seeded demo. The current MVP still uses self-claim, not proof-gated on-chain verification.",
    },
  ],
});

const finalState = {
  network: networkName,
  mode: demoConfig.deploymentAddresses === undefined
    ? "fresh-local-deploy"
    : "loaded-addresses",
  deployedAddresses: {
    governanceToken: deployed.governanceToken.address,
    treasury: deployed.treasury.address,
    distributor: deployed.distributor.address,
    governanceTimelock: deployed.governanceTimelock.address,
    governanceGovernor: deployed.governanceGovernor.address,
  },
  demoStory: {
    treasuryFundingEth: formatEth(demoConfig.treasuryFunding),
    timelockFundingEth: formatEth(demoConfig.timelockFunding),
    governanceParticipantFunding: formatEth(
      demoConfig.governanceParticipantTokenAllocation,
    ),
    operationsBucketId: demoConfig.operationsBucketId,
    distributionId: demoConfig.distributionId,
    distributionLabel: demoConfig.distributionLabel,
    operationsRecipient: operationsRecipientAddress,
    distributionRecipient: distributionRecipientAddress,
  },
  claimArtifact,
  demoActors: [
    {
      role: "bootstrap-admin",
      walletIndex: 0,
      address: deployerAddress,
      story: "Initial deployer, bootstrap actor, and seeded governance driver.",
    },
    {
      role: "governance-participant",
      walletIndex: 1,
      address: governanceParticipantAddress,
      story: "Non-bootstrap governance user with self-delegated votes for proposal and voting demos.",
    },
    {
      role: "treasury-recipient",
      walletIndex: 2,
      address: operationsRecipientAddress,
      story: "Recipient of the seeded operating spend from the treasury bucket.",
    },
    {
      role: "distribution-claimant",
      walletIndex: 3,
      address: distributionRecipientAddress,
      story: "Suggested claimant for the seeded distribution demo. In this MVP claim path, this is a demo role rather than an enforced allowlist.",
    },
    {
      role: "viewer",
      walletIndex: 4,
      address: viewerAddress,
      story: "Optional read-first account for observing the system without using the seeded actor flows.",
    },
  ],
  treasury: {
    owner: await deployed.treasury.read.owner(),
    totalBalance: (await deployed.treasury.read.totalBalance([zeroAddress()])).toString(),
    operatingClassified: (
      await deployed.treasury.read.classifiedBalance([zeroAddress(), 1])
    ).toString(),
    availableOperating: (
      await deployed.treasury.read.availableOperatingBalance([zeroAddress()])
    ).toString(),
    unallocated: (
      await deployed.treasury.read.unallocatedBalance([zeroAddress()])
    ).toString(),
    bucket: {
      allocated: bucketAllocated.toString(),
      spent: bucketSpent.toString(),
      remaining: bucketRemaining.toString(),
    },
  },
  distributor: {
    owner: await deployed.distributor.read.owner(),
    fundedAmount: (await deployed.distributor.read.fundedAmount([
      demoConfig.distributionId,
    ])).toString(),
    totalOutstanding: (
      await deployed.distributor.read.totalOutstandingForAsset([zeroAddress()])
    ).toString(),
    distributionState: {
      asset: distributionState.asset,
      totalAmount: distributionState.totalAmount.toString(),
      fundedAmount: distributionState.fundedAmount.toString(),
      claimedAmount: distributionState.claimedAmount.toString(),
      status: Number(distributionState.status),
    },
  },
  governance: {
    bootstrapVotes: delegatedVotes.toString(),
    governanceParticipantVotes: governanceParticipantVotes.toString(),
    proposalThreshold: deployConfig.governor.proposalThreshold.toString(),
    timelockAdmin: await deployed.governanceTimelock.read.admin(),
    timelockProposer: await deployed.governanceTimelock.read.proposer(),
    timelockExecutor: await deployed.governanceTimelock.read.executor(),
    timelockMinDelay: (await deployed.governanceTimelock.read.minDelay()).toString(),
  },
  notes: [
    "This local seed intentionally creates a small multi-user story across bootstrap governance, a second governance participant, a treasury recipient, and a suggested distribution claimant.",
    "Treasury capital was classified, bucketed, and partially spent through governance.",
    "A claimable community distribution was created and funded through the governor and timelock.",
    "The seeded distribution is intentionally left unclaimed so the demo still has a next action.",
    "The governance participant is a real token holder with self-delegated votes, but demo account role labels are still a local convenience rather than a production identity system.",
    "This MVP does not yet route treasury distributable balances directly into the distributor, so the demo funds the distributor from ETH held by the timelock.",
  ],
};

console.log("");
console.log("Demo Summary");
console.log("============");
console.log(`GovernanceToken:     ${deployed.governanceToken.address}`);
console.log(`Treasury:            ${deployed.treasury.address}`);
console.log(`Distributor:         ${deployed.distributor.address}`);
console.log(`GovernanceTimelock:  ${deployed.governanceTimelock.address}`);
console.log(`GovernanceGovernor:  ${deployed.governanceGovernor.address}`);
console.log(`Bootstrap actor:     ${deployerAddress} (Hardhat account #0)`);
console.log(`Gov participant:     ${governanceParticipantAddress} (Hardhat account #1)`);
console.log(`Operations bucket:   ${demoConfig.operationsBucketId}`);
console.log(`Treasury recipient:  ${operationsRecipientAddress} (Hardhat account #2)`);
console.log(`Distribution id:     ${demoConfig.distributionId}`);
console.log(`Claim recipient:     ${distributionRecipientAddress} (Hardhat account #3)`);
console.log(`Viewer account:      ${viewerAddress} (Hardhat account #4)`);
console.log("");
console.log("Claim Package");
console.log("=============");
console.log(
  `Current MVP claim request: distributionId=${demoConfig.distributionId}, recipient=${distributionRecipientAddress}, amount=${formatEth(demoConfig.distributionFunding)} ETH`,
);
console.log(`Future-compatible Merkle root: ${claimArtifact.proofModel.merkleRoot}`);
console.log("");
console.log("Seeded State (JSON)");
console.log(JSON.stringify(finalState, bigintReplacer, 2));

async function deployFreshLocalStack() {
  console.log(
    "No reusable deployment addresses were configured, so a fresh local MVP stack will be deployed before seeding.",
  );

  const governanceToken = await viem.deployContract(
    "GovernanceToken",
    [
      deployConfig.token.name,
      deployConfig.token.symbol,
      deployerAddress,
      deployerAddress,
      deployConfig.token.initialSupply,
    ],
    { client: { wallet: deployer } },
  );

  const treasury = await viem.deployContract("Treasury", [deployerAddress], {
    client: { wallet: deployer },
  });

  const distributor = await viem.deployContract("Distributor", [deployerAddress], {
    client: { wallet: deployer },
  });

  const governanceTimelock = await viem.deployContract(
    "GovernanceTimelock",
    [
      deployConfig.timelock.minDelay,
      deployerAddress,
      deployerAddress,
      deployerAddress,
    ],
    { client: { wallet: deployer } },
  );

  const governanceGovernor = await viem.deployContract(
    "GovernanceGovernor",
    [
      deployConfig.governor.name,
      governanceToken.address,
      governanceTimelock.address,
      deployConfig.governor.votingDelay,
      deployConfig.governor.votingPeriod,
      deployConfig.governor.proposalThreshold,
      deployConfig.governor.quorumNumeratorBps,
    ],
    { client: { wallet: deployer } },
  );

  if (deployConfig.token.selfDelegateInitialVotes && deployConfig.token.initialSupply > 0n) {
    await waitForTransaction(governanceToken.write.delegate([deployerAddress]));
  }

  await waitForTransaction(
    governanceTimelock.write.updateProposer([governanceGovernor.address]),
  );
  await waitForTransaction(
    governanceTimelock.write.updateExecutor([governanceGovernor.address]),
  );
  await waitForTransaction(
    governanceToken.write.transferOwnership([governanceTimelock.address]),
  );
  await waitForTransaction(
    treasury.write.transferOwnership([governanceTimelock.address]),
  );
  await waitForTransaction(
    distributor.write.transferOwnership([governanceTimelock.address]),
  );

  if (deployConfig.timelock.selfAdminAfterBootstrap) {
    await waitForTransaction(
      governanceTimelock.write.updateAdmin([governanceTimelock.address]),
    );
  }

  return {
    governanceToken,
    treasury,
    distributor,
    governanceTimelock,
    governanceGovernor,
  };
}

async function loadDeployedContracts(addresses: SeedV3DeploymentAddresses) {
  console.log("Loading deployed addresses from configuration.");

  const governanceToken = await viem.getContractAt(
    "GovernanceToken",
    addresses.governanceToken,
  );
  const treasury = await viem.getContractAt("Treasury", addresses.treasury);
  const distributor = await viem.getContractAt(
    "Distributor",
    addresses.distributor,
  );
  const governanceTimelock = await viem.getContractAt(
    "GovernanceTimelock",
    addresses.governanceTimelock,
  );
  const governanceGovernor = await viem.getContractAt(
    "GovernanceGovernor",
    addresses.governanceGovernor,
  );

  return {
    governanceToken,
    treasury,
    distributor,
    governanceTimelock,
    governanceGovernor,
  };
}

async function executeGovernanceAction(action: {
  target: Address;
  value?: bigint;
  data: Hex;
  description: string;
}) {
  const value = action.value ?? 0n;

  console.log(`- ${action.description}`);

  await waitForTransaction(
    deployed.governanceGovernor.write.propose([
      action.target,
      value,
      action.data,
      action.description,
    ]),
  );

  const proposalId = await deployed.governanceGovernor.read.proposalCount();

  await networkHelpers.mine(2);
  await waitForTransaction(
    deployed.governanceGovernor.write.castVote([proposalId, 1]),
  );

  await networkHelpers.mine(Number(deployConfig.governor.votingPeriod) + 1);
  await waitForTransaction(
    deployed.governanceGovernor.write.queue([proposalId]),
  );

  await networkHelpers.time.increase(Number(deployConfig.timelock.minDelay) + 1);
  await networkHelpers.mine();

  await waitForTransaction(
    deployed.governanceGovernor.write.execute([proposalId]),
  );
}

async function waitForTransaction(txHashPromise: Promise<Hex>) {
  const txHash = await txHashPromise;
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

function formatEth(amount: bigint): string {
  return (Number(amount) / 1e18).toString();
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function zeroAddress(): Address {
  return "0x0000000000000000000000000000000000000000";
}
