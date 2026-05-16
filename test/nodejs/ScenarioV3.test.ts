import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import {
  encodeFunctionData,
  getAddress,
  parseEther,
  zeroAddress,
} from "viem";

import {
  deployPostHandoffMvpFixture,
  distributionId,
  executeGovernanceProposal,
} from "./helpers/fixtures.js";

const connection = await network.create({ network: "hardhatMainnet" });

describe("ScenarioV3", async function () {
  it("governs treasury capital into operating spend and a funded community distribution", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(deployPostHandoffMvpFixture);

    const operationsBucketId = "0x" + "33".repeat(32);
    const communityDistributionId = distributionId("scenario-v3-community");

    await fixture.publicClient.waitForTransactionReceipt({
      hash: await fixture.deployer.sendTransaction({
        to: fixture.treasury.address,
        value: parseEther("5"),
      }),
    });
    await fixture.publicClient.waitForTransactionReceipt({
      hash: await fixture.deployer.sendTransaction({
        to: fixture.governanceTimelock.address,
        value: parseEther("2"),
      }),
    });

    await executeGovernanceProposal(fixture, {
      target: fixture.treasury.address,
      data: encodeFunctionData({
        abi: fixture.treasury.abi,
        functionName: "classifyCapital",
        args: [zeroAddress, 1, parseEther("3")],
      }),
      description: "Classify operating capital for the MVP operating budget",
    });

    await executeGovernanceProposal(fixture, {
      target: fixture.treasury.address,
      data: encodeFunctionData({
        abi: fixture.treasury.abi,
        functionName: "allocateBudget",
        args: [
          {
            bucketId: operationsBucketId,
            asset: zeroAddress,
            amount: parseEther("2"),
          },
        ],
      }),
      description: "Allocate an operating bucket for the core team",
    });

    await executeGovernanceProposal(fixture, {
      target: fixture.treasury.address,
      data: encodeFunctionData({
        abi: fixture.treasury.abi,
        functionName: "spend",
        args: [
          {
            bucketId: operationsBucketId,
            asset: zeroAddress,
            recipient: fixture.treasuryRecipientAddress,
            amount: parseEther("1"),
          },
        ],
      }),
      description: "Spend part of the operating budget on MVP delivery",
    });

    await executeGovernanceProposal(fixture, {
      target: fixture.distributor.address,
      data: encodeFunctionData({
        abi: fixture.distributor.abi,
        functionName: "createDistribution",
        args: [
          {
            distributionId: communityDistributionId,
            asset: zeroAddress,
            totalAmount: parseEther("2"),
          },
        ],
      }),
      description: "Create a funded community distribution event",
    });

    await executeGovernanceProposal(fixture, {
      target: fixture.distributor.address,
      value: parseEther("2"),
      data: encodeFunctionData({
        abi: fixture.distributor.abi,
        functionName: "fundDistribution",
        args: [communityDistributionId, parseEther("2")],
      }),
      description: "Fund the community distribution from governed capital",
    });

    const distributorAsRecipient = await fixture.connection.viem.getContractAt(
      "Distributor",
      fixture.distributor.address,
      { client: { wallet: fixture.distributionRecipient } },
    );

    await fixture.publicClient.waitForTransactionReceipt({
      hash: await distributorAsRecipient.write.claim([
        {
          distributionId: communityDistributionId,
          recipient: fixture.distributionRecipientAddress,
          amount: parseEther("2"),
        },
      ]),
    });

    assert.equal(
      getAddress(await fixture.treasury.read.owner()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      getAddress(await fixture.distributor.read.owner()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      await fixture.treasury.read.classifiedBalance([zeroAddress, 1]),
      parseEther("2"),
    );
    assert.equal(
      await fixture.treasury.read.availableOperatingBalance([zeroAddress]),
      parseEther("1"),
    );
    assert.equal(
      await fixture.treasury.read.unallocatedBalance([zeroAddress]),
      parseEther("2"),
    );

    const [allocated, spentAmount, remaining] =
      await fixture.treasury.read.bucketStatus([
        operationsBucketId,
        zeroAddress,
      ]);

    assert.equal(allocated, parseEther("2"));
    assert.equal(spentAmount, parseEther("1"));
    assert.equal(remaining, parseEther("1"));
    assert.equal(
      await fixture.distributor.read.fundedAmount([communityDistributionId]),
      parseEther("2"),
    );
    assert.equal(
      await fixture.distributor.read.claimedAmount([
        communityDistributionId,
        fixture.distributionRecipientAddress,
      ]),
      parseEther("2"),
    );

    const distributionState = await fixture.distributor.read.distributionState([
      communityDistributionId,
    ]);

    assert.equal(distributionState.asset, zeroAddress);
    assert.equal(distributionState.fundedAmount, parseEther("2"));
    assert.equal(distributionState.claimedAmount, parseEther("2"));
    assert.equal(distributionState.status, 2);
    assert.equal(
      await fixture.distributor.read.totalOutstandingForAsset([zeroAddress]),
      0n,
    );
  });
});
