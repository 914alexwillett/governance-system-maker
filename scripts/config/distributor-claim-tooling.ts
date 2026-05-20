import type { Address, Hex } from "viem";
import { encodePacked, keccak256, zeroAddress } from "viem";

export interface DistributionClaimEntryInput {
  label: string;
  recipient: Address;
  amount: bigint;
  note: string;
}

export interface DistributionClaimScenario {
  distributionId: `0x${string}`;
  distributionLabel: string;
  asset: Address;
  totalAmount: bigint;
  claims: DistributionClaimEntryInput[];
}

export interface DistributionClaimArtifact {
  version: "distribution-claim-artifact-v1";
  proofModel: {
    enforcedOnChain: false;
    currentMvpMode: "self-claim";
    futureCompatibleEncoding: "keccak256(bytes32 distributionId,address recipient,uint256 amount)";
    merkleRoot: Hex;
  };
  distribution: {
    distributionId: `0x${string}`;
    distributionLabel: string;
    asset: Address;
    assetLabel: string;
    totalAmount: string;
    totalClaimAmount: string;
    unassignedAmount: string;
  };
  claims: Array<{
    index: number;
    label: string;
    recipient: Address;
    amount: string;
    leaf: Hex;
    merkleProof: Hex[];
    currentMvpClaimRequest: {
      distributionId: `0x${string}`;
      recipient: Address;
      amount: string;
    };
    note: string;
  }>;
  notes: string[];
}

export function buildDistributionClaimArtifact(
  scenario: DistributionClaimScenario,
): DistributionClaimArtifact {
  if (scenario.claims.length === 0) {
    throw new Error("At least one claim entry is required to build a claim artifact.");
  }

  const totalClaimAmount = scenario.claims.reduce(
    (sum, claim) => sum + claim.amount,
    0n,
  );

  if (totalClaimAmount > scenario.totalAmount) {
    throw new Error(
      "Claim entries exceed the configured distribution total amount.",
    );
  }

  const leafRecords = scenario.claims.map((claim, index) => {
    if (claim.amount <= 0n) {
      throw new Error(`Claim amount must be greater than zero for ${claim.label}.`);
    }

    const leaf = distributionClaimLeaf(
      scenario.distributionId,
      claim.recipient,
      claim.amount,
    );

    return {
      ...claim,
      index,
      leaf,
    };
  });

  const { root, proofs } = buildMerkleArtifacts(
    leafRecords.map((record) => record.leaf),
  );
  const unassignedAmount = scenario.totalAmount - totalClaimAmount;

  return {
    version: "distribution-claim-artifact-v1",
    proofModel: {
      enforcedOnChain: false,
      currentMvpMode: "self-claim",
      futureCompatibleEncoding:
        "keccak256(bytes32 distributionId,address recipient,uint256 amount)",
      merkleRoot: root,
    },
    distribution: {
      distributionId: scenario.distributionId,
      distributionLabel: scenario.distributionLabel,
      asset: scenario.asset,
      assetLabel: scenario.asset === zeroAddress ? "ETH" : scenario.asset,
      totalAmount: scenario.totalAmount.toString(),
      totalClaimAmount: totalClaimAmount.toString(),
      unassignedAmount: unassignedAmount.toString(),
    },
    claims: leafRecords.map((record) => ({
      index: record.index,
      label: record.label,
      recipient: record.recipient,
      amount: record.amount.toString(),
      leaf: record.leaf,
      merkleProof: proofs[record.index] ?? [],
      currentMvpClaimRequest: {
        distributionId: scenario.distributionId,
        recipient: record.recipient,
        amount: record.amount.toString(),
      },
      note: record.note,
    })),
    notes: [
      "This artifact is an MVP demo and test helper. The current Distributor contract does not verify Merkle proofs on-chain yet.",
      "currentMvpClaimRequest shows the exact self-claim request shape the current contract accepts today.",
      "merkleRoot and merkleProof are future-compatible convenience data for explaining or testing an entitlement-style claim model later.",
      unassignedAmount > 0n
        ? "Some distribution capacity is still unassigned in this artifact. That is allowed in the current MVP, but it is shown explicitly here."
        : "The listed claim entries account for the full configured distribution amount.",
    ],
  };
}

export function distributionClaimLeaf(
  distributionId: `0x${string}`,
  recipient: Address,
  amount: bigint,
): Hex {
  return keccak256(
    encodePacked(
      ["bytes32", "address", "uint256"],
      [distributionId, recipient, amount],
    ),
  );
}

function buildMerkleArtifacts(leaves: Hex[]) {
  if (leaves.length === 0) {
    throw new Error("Merkle tree generation requires at least one leaf.");
  }

  const proofs = leaves.map(() => [] as Hex[]);
  let layer = leaves.map((leaf, index) => ({ hash: leaf, leafIndexes: [index] }));

  while (layer.length > 1) {
    const nextLayer: Array<{ hash: Hex; leafIndexes: number[] }> = [];

    for (let index = 0; index < layer.length; index += 2) {
      const left = layer[index];
      const right = layer[index + 1];

      if (right === undefined) {
        nextLayer.push(left);
        continue;
      }

      for (const leafIndex of left.leafIndexes) {
        proofs[leafIndex]?.push(right.hash);
      }
      for (const leafIndex of right.leafIndexes) {
        proofs[leafIndex]?.push(left.hash);
      }

      nextLayer.push({
        hash: hashPair(left.hash, right.hash),
        leafIndexes: [...left.leafIndexes, ...right.leafIndexes],
      });
    }

    layer = nextLayer;
  }

  return {
    root: layer[0]?.hash ?? zeroHash(),
    proofs,
  };
}

function hashPair(left: Hex, right: Hex): Hex {
  const [first, second] = sortHashes(left, right);
  return keccak256(encodePacked(["bytes32", "bytes32"], [first, second]));
}

function sortHashes(left: Hex, right: Hex): [Hex, Hex] {
  return left.toLowerCase() <= right.toLowerCase()
    ? [left, right]
    : [right, left];
}

function zeroHash(): Hex {
  return `0x${"00".repeat(32)}`;
}
