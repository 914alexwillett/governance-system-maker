import { network } from "hardhat";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";

import { getDeployV3Config } from "./config/deploy-v3.js";

type DeploymentAddresses = {
  governanceToken: Address;
  treasury: Address;
  distributor: Address;
  governanceTimelock: Address;
  governanceGovernor: Address;
};

const { networkName, viem } = await network.create();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

if (deployer.account === undefined) {
  throw new Error("No deployer wallet client is available for this network.");
}

const deployerAddress = getAddress(deployer.account.address);
const config = getDeployV3Config(networkName);

console.log(`Deploying Governance Capital MVP to ${networkName}`);
console.log(`Bootstrap deployer: ${deployerAddress}`);

const governanceToken = await viem.deployContract(
  "GovernanceToken",
  [
    config.token.name,
    config.token.symbol,
    deployerAddress,
    deployerAddress,
    config.token.initialSupply,
  ],
  { client: { wallet: deployer } }
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
    config.timelock.minDelay,
    deployerAddress,
    deployerAddress,
    deployerAddress,
  ],
  { client: { wallet: deployer } }
);

const governanceGovernor = await viem.deployContract(
  "GovernanceGovernor",
  [
    config.governor.name,
    governanceToken.address,
    governanceTimelock.address,
    config.governor.votingDelay,
    config.governor.votingPeriod,
    config.governor.proposalThreshold,
    config.governor.quorumNumeratorBps,
  ],
  { client: { wallet: deployer } }
);

if (config.token.selfDelegateInitialVotes && config.token.initialSupply > 0n) {
  await waitForTransaction(
    governanceToken.write.delegate([deployerAddress])
  );
}

await waitForTransaction(
  governanceTimelock.write.updateProposer([governanceGovernor.address])
);
await waitForTransaction(
  governanceTimelock.write.updateExecutor([governanceGovernor.address])
);

await waitForTransaction(
  governanceToken.write.transferOwnership([governanceTimelock.address])
);
await waitForTransaction(
  treasury.write.transferOwnership([governanceTimelock.address])
);
await waitForTransaction(
  distributor.write.transferOwnership([governanceTimelock.address])
);

if (config.timelock.selfAdminAfterBootstrap) {
  await waitForTransaction(
    governanceTimelock.write.updateAdmin([governanceTimelock.address])
  );
}

const deployedAddresses: DeploymentAddresses = {
  governanceToken: governanceToken.address,
  treasury: treasury.address,
  distributor: distributor.address,
  governanceTimelock: governanceTimelock.address,
  governanceGovernor: governanceGovernor.address,
};

const postDeployState = {
  network: networkName,
  deployer: deployerAddress,
  deployedAddresses,
  governance: {
    tokenOwner: await governanceToken.read.owner(),
    treasuryOwner: await treasury.read.owner(),
    distributorOwner: await distributor.read.owner(),
    timelockAdmin: await governanceTimelock.read.admin(),
    timelockProposer: await governanceTimelock.read.proposer(),
    timelockExecutor: await governanceTimelock.read.executor(),
    timelockMinDelay: await governanceTimelock.read.minDelay(),
    delegatedVotes: await governanceToken.read.getVotes([deployerAddress]),
  },
  config: {
    token: {
      name: config.token.name,
      symbol: config.token.symbol,
      initialSupply: config.token.initialSupply.toString(),
    },
    timelock: {
      minDelay: config.timelock.minDelay.toString(),
      selfAdminAfterBootstrap: config.timelock.selfAdminAfterBootstrap,
    },
    governor: {
      name: config.governor.name,
      votingDelay: config.governor.votingDelay.toString(),
      votingPeriod: config.governor.votingPeriod.toString(),
      proposalThreshold: config.governor.proposalThreshold.toString(),
      quorumNumeratorBps: config.governor.quorumNumeratorBps.toString(),
    },
  },
  handoffSteps: [
    "Deployer bootstrapped all modules as the temporary owner/admin.",
    "Governor was deployed with the token and timelock addresses.",
    "Initial token votes were delegated to the deployer for local MVP proposal bootstrapping.",
    "Timelock proposer and executor were reassigned to the governor contract.",
    "Token, treasury, and distributor ownership were transferred to the timelock.",
    config.timelock.selfAdminAfterBootstrap
      ? "Timelock admin was transferred to the timelock itself."
      : "Timelock admin was retained by the bootstrap deployer.",
  ],
};

console.log("");
console.log("Deployment Summary");
console.log("==================");
console.log(`GovernanceToken:     ${deployedAddresses.governanceToken}`);
console.log(`Treasury:            ${deployedAddresses.treasury}`);
console.log(`Distributor:         ${deployedAddresses.distributor}`);
console.log(`GovernanceTimelock:  ${deployedAddresses.governanceTimelock}`);
console.log(`GovernanceGovernor:  ${deployedAddresses.governanceGovernor}`);
console.log("");
console.log("Deployment Output (JSON)");
console.log(JSON.stringify(postDeployState, bigintReplacer, 2));

async function waitForTransaction(txHashPromise: Promise<Hex>): Promise<void> {
  const txHash = await txHashPromise;
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
