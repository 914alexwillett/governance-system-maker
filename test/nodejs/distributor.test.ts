import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";

import {
  deployPreHandoffMvpFixture,
  distributionId,
  fundNativeDistributorFixture,
} from "./helpers/fixtures.js";

const connection = await network.create({ network: "hardhatMainnet" });

describe("Distributor", async function () {
  it("supports a funded native distribution and a happy-path self-claim", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(fundNativeDistributorFixture);

    await fixture.distributorAsRecipient.write.claim([
      {
        distributionId: fixture.fundedDistributionId,
        recipient: fixture.distributionRecipientAddress,
        amount: parseEther("2"),
      },
    ]);

    assert.equal(
      await fixture.distributor.read.fundedAmount([fixture.fundedDistributionId]),
      parseEther("2"),
    );
    assert.equal(
      await fixture.distributor.read.claimedAmount([
        fixture.fundedDistributionId,
        fixture.distributionRecipientAddress,
      ]),
      parseEther("2"),
    );

    const state = await fixture.distributor.read.distributionState([
      fixture.fundedDistributionId,
    ]);
    assert.equal(state.asset, zeroAddress);
    assert.equal(state.claimedAmount, parseEther("2"));
    assert.equal(state.status, 2);
    assert.equal(
      await fixture.distributor.read.totalOutstandingForAsset([zeroAddress]),
      0n,
    );
  });

  it("does not allow funding beyond the configured distribution amount", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(deployPreHandoffMvpFixture);

    const distribution = distributionId("native-overfund");

    await fixture.distributor.write.createDistribution([
      {
        distributionId: distribution,
        asset: zeroAddress,
        totalAmount: parseEther("2"),
      },
    ]);

    await assert.rejects(
      fixture.distributor.write.fundDistribution(
        [distribution, parseEther("3")],
        { value: parseEther("3") },
      ),
      /Distributor__FundingExceedsDistributionAmount/,
    );
  });

  it("requires self-claims and rejects repeat claims after a fully claimed event closes", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(fundNativeDistributorFixture);

    await assert.rejects(
      fixture.distributor.write.claim([
        {
          distributionId: fixture.fundedDistributionId,
          recipient: fixture.distributionRecipientAddress,
          amount: parseEther("2"),
        },
      ]),
      /Distributor__Unauthorized/,
    );

    await fixture.distributorAsRecipient.write.claim([
      {
        distributionId: fixture.fundedDistributionId,
        recipient: fixture.distributionRecipientAddress,
        amount: parseEther("2"),
      },
    ]);

    await assert.rejects(
      fixture.distributorAsRecipient.write.claim([
        {
          distributionId: fixture.fundedDistributionId,
          recipient: fixture.distributionRecipientAddress,
          amount: parseEther("2"),
        },
      ]),
      /Distributor__DistributionNotFunded/,
    );
  });

  it("supports staged funding and closes only after the full event amount is claimed", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(deployPreHandoffMvpFixture);

    const distribution = distributionId("native-staged-funding");

    await fixture.distributor.write.createDistribution([
      {
        distributionId: distribution,
        asset: zeroAddress,
        totalAmount: parseEther("3"),
      },
    ]);
    await fixture.distributor.write.fundDistribution(
      [distribution, parseEther("1")],
      { value: parseEther("1") },
    );
    await fixture.distributor.write.fundDistribution(
      [distribution, parseEther("2")],
      { value: parseEther("2") },
    );

    await fixture.distributor.write.claim([
      {
        distributionId: distribution,
        recipient: fixture.deployerAddress,
        amount: parseEther("1"),
      },
    ]);

    assert.equal(
      await fixture.distributor.read.distributionStatus([distribution]),
      1,
    );
    assert.equal(
      await fixture.distributor.read.totalOutstandingForAsset([zeroAddress]),
      parseEther("2"),
    );

    const distributorAsRecipient = await fixture.connection.viem.getContractAt(
      "Distributor",
      fixture.distributor.address,
      { client: { wallet: fixture.distributionRecipient } },
    );

    await distributorAsRecipient.write.claim([
      {
        distributionId: distribution,
        recipient: fixture.distributionRecipientAddress,
        amount: parseEther("2"),
      },
    ]);

    const state = await fixture.distributor.read.distributionState([distribution]);
    assert.equal(state.fundedAmount, parseEther("3"));
    assert.equal(state.claimedAmount, parseEther("3"));
    assert.equal(state.status, 2);
    assert.equal(
      await fixture.distributor.read.totalOutstandingForAsset([zeroAddress]),
      0n,
    );
  });
});
