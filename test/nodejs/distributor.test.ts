import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";

import { fundNativeDistributorFixture } from "./helpers/fixtures.js";

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
});
