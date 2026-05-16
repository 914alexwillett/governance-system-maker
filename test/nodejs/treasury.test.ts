import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";

import { fundNativeTreasuryFixture } from "./helpers/fixtures.js";

const connection = await network.create({ network: "hardhatMainnet" });

describe("Treasury", async function () {
  it("tracks classified balances, bucket commitments, and native spending", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(fundNativeTreasuryFixture);

    await fixture.treasury.write.classifyCapital([
      zeroAddress,
      1,
      parseEther("7"),
    ]);
    await fixture.treasury.write.classifyCapital([
      zeroAddress,
      2,
      parseEther("2"),
    ]);
    await fixture.treasury.write.allocateBudget([
      {
        bucketId: "0x" + "11".repeat(32),
        asset: zeroAddress,
        amount: parseEther("4"),
      },
    ]);
    await fixture.treasury.write.spend([
      {
        bucketId: "0x" + "11".repeat(32),
        asset: zeroAddress,
        recipient: fixture.treasuryRecipientAddress,
        amount: parseEther("1"),
      },
    ]);

    assert.equal(
      await fixture.treasury.read.classifiedBalance([zeroAddress, 1]),
      parseEther("6"),
    );
    assert.equal(
      await fixture.treasury.read.classifiedBalance([zeroAddress, 2]),
      parseEther("2"),
    );
    assert.equal(
      await fixture.treasury.read.availableOperatingBalance([zeroAddress]),
      parseEther("3"),
    );
    assert.equal(
      await fixture.treasury.read.unallocatedBalance([zeroAddress]),
      parseEther("1"),
    );

    const [allocated, spentAmount, remaining] =
      await fixture.treasury.read.bucketStatus([
        "0x" + "11".repeat(32),
        zeroAddress,
      ]);

    assert.equal(allocated, parseEther("4"));
    assert.equal(spentAmount, parseEther("1"));
    assert.equal(remaining, parseEther("3"));
  });

  it("does not allow declassifying operating capital already committed to buckets", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(fundNativeTreasuryFixture);

    await fixture.treasury.write.classifyCapital([
      zeroAddress,
      1,
      parseEther("5"),
    ]);
    await fixture.treasury.write.allocateBudget([
      {
        bucketId: "0x" + "22".repeat(32),
        asset: zeroAddress,
        amount: parseEther("4"),
      },
    ]);

    await assert.rejects(
      fixture.treasury.write.declassifyCapital([
        zeroAddress,
        1,
        parseEther("2"),
      ]),
      /Treasury__InsufficientClassifiedBalance/,
    );
  });
});
