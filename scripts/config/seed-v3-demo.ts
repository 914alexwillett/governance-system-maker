import type { Address } from "viem";
import { keccak256, parseEther, stringToHex } from "viem";

export interface SeedV3DeploymentAddresses {
  governanceToken: Address;
  treasury: Address;
  distributor: Address;
  governanceTimelock: Address;
  governanceGovernor: Address;
}

export interface SeedV3DemoConfig {
  treasuryFunding: bigint;
  timelockFunding: bigint;
  operatingClassification: bigint;
  operatingBucketAllocation: bigint;
  operatingSpendAmount: bigint;
  distributionFunding: bigint;
  operationsBucketId: `0x${string}`;
  distributionId: `0x${string}`;
  distributionLabel: string;
  deploymentAddresses?: SeedV3DeploymentAddresses;
}

const sharedConfig: Omit<SeedV3DemoConfig, "deploymentAddresses"> = {
  treasuryFunding: parseEther("5"),
  timelockFunding: parseEther("2"),
  operatingClassification: parseEther("3"),
  operatingBucketAllocation: parseEther("2"),
  operatingSpendAmount: parseEther("1"),
  distributionFunding: parseEther("2"),
  operationsBucketId: "0x" + "44".repeat(32),
  distributionId: keccak256(stringToHex("demo-v3-community-grant")),
  distributionLabel: "demo-v3-community-grant",
};

export function getSeedV3DemoConfig(networkName: string): SeedV3DemoConfig {
  const deploymentAddresses = readDeploymentAddressesFromEnvironment();

  return {
    ...sharedConfig,
    deploymentAddresses:
      networkName === "hardhatMainnet" ? undefined : deploymentAddresses,
  };
}

function readDeploymentAddressesFromEnvironment():
  | SeedV3DeploymentAddresses
  | undefined {
  const governanceToken = readAddress("GOVCAP_TOKEN_ADDRESS");
  const treasury = readAddress("GOVCAP_TREASURY_ADDRESS");
  const distributor = readAddress("GOVCAP_DISTRIBUTOR_ADDRESS");
  const governanceTimelock = readAddress("GOVCAP_TIMELOCK_ADDRESS");
  const governanceGovernor = readAddress("GOVCAP_GOVERNOR_ADDRESS");

  if (
    governanceToken === undefined ||
    treasury === undefined ||
    distributor === undefined ||
    governanceTimelock === undefined ||
    governanceGovernor === undefined
  ) {
    return undefined;
  }

  return {
    governanceToken,
    treasury,
    distributor,
    governanceTimelock,
    governanceGovernor,
  };
}

function readAddress(name: string): Address | undefined {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return value as Address;
}
