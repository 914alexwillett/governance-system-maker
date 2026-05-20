import { network } from "hardhat";
import { getAddress, zeroAddress } from "viem";

import {
  buildDistributionClaimArtifact,
  type DistributionClaimScenario,
} from "./config/distributor-claim-tooling.js";
import { getSeedV3DemoConfig } from "./config/seed-v3-demo.js";

const { networkName, viem } = await network.create();
const [, , , distributionRecipient] = await viem.getWalletClients();

if (distributionRecipient.account === undefined) {
  throw new Error("Expected a default distribution recipient wallet client.");
}

const distributionRecipientAddress = getAddress(distributionRecipient.account.address);
const demoConfig = getSeedV3DemoConfig(networkName);

const scenario: DistributionClaimScenario = {
  distributionId: demoConfig.distributionId,
  distributionLabel: demoConfig.distributionLabel,
  asset: zeroAddress,
  totalAmount: demoConfig.distributionFunding,
  claims: [
    {
      label: "Seeded distribution claimant",
      recipient: distributionRecipientAddress,
      amount: demoConfig.distributionFunding,
      note: "This is the suggested local demo claimant account used in the seeded MVP flow.",
    },
  ],
};

const artifact = buildDistributionClaimArtifact(scenario);

console.log(`Preparing Distributor claim artifact on ${networkName}`);
console.log("");
console.log("Claim Flow Notes");
console.log("================");
console.log(
  "- The current Distributor contract does not require Merkle proofs on-chain yet.",
);
console.log(
  "- This script still generates future-compatible Merkle leaf, root, and proof data so claim setup is easier to explain and reuse.",
);
console.log(
  "- currentMvpClaimRequest is the exact request shape the current self-claim flow accepts today.",
);
console.log("");
console.log("Claim Artifact (JSON)");
console.log("=====================");
console.log(JSON.stringify(artifact, bigintReplacer, 2));

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
