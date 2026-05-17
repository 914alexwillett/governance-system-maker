import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { encodeFunctionData, getAddress, parseEther, zeroAddress } from "viem";

import { deployPostHandoffMvpFixture } from "./helpers/fixtures.js";

const connection = await network.create({ network: "hardhatMainnet" });

describe("Governance lifecycle", async function () {
  it("moves ownership and timelock roles into the expected post-handoff state", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(deployPostHandoffMvpFixture);

    assert.equal(
      getAddress(await fixture.governanceToken.read.owner()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      getAddress(await fixture.treasury.read.owner()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      getAddress(await fixture.distributor.read.owner()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      getAddress(await fixture.governanceTimelock.read.admin()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      getAddress(await fixture.governanceTimelock.read.proposer()),
      getAddress(fixture.governanceGovernor.address),
    );
    assert.equal(
      getAddress(await fixture.governanceTimelock.read.executor()),
      getAddress(fixture.governanceGovernor.address),
    );
  });

  it("executes a treasury action through the governor and timelock after ownership handoff", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(deployPostHandoffMvpFixture);

    await fixture.publicClient.waitForTransactionReceipt({
      hash: await fixture.deployer.sendTransaction({
        to: fixture.treasury.address,
        value: parseEther("5"),
      }),
    });

    const classifyCalldata = encodeFunctionData({
      abi: fixture.treasury.abi,
      functionName: "classifyCapital",
      args: [zeroAddress, 1, parseEther("2")],
    });

    await fixture.governanceGovernor.write.propose([
      fixture.treasury.address,
      0n,
      classifyCalldata,
      "Classify operating capital",
    ]);

    const proposalId = await fixture.governanceGovernor.read.proposalCount();
    assert.equal(await fixture.governanceGovernor.read.state([proposalId]), 0);

    await fixture.connection.networkHelpers.mine(2);
    assert.equal(await fixture.governanceGovernor.read.state([proposalId]), 1);

    await fixture.governanceGovernor.write.castVote([proposalId, 1]);

    await fixture.connection.networkHelpers.mine(6);
    assert.equal(await fixture.governanceGovernor.read.state([proposalId]), 3);

    await fixture.governanceGovernor.write.queue([proposalId]);
    assert.equal(await fixture.governanceGovernor.read.state([proposalId]), 4);

    await fixture.connection.networkHelpers.time.increase(61);
    await fixture.connection.networkHelpers.mine();

    await fixture.governanceGovernor.write.execute([proposalId]);

    assert.equal(await fixture.governanceGovernor.read.state([proposalId]), 5);
    assert.equal(
      getAddress(await fixture.treasury.read.owner()),
      getAddress(fixture.governanceTimelock.address),
    );
    assert.equal(
      await fixture.treasury.read.classifiedBalance([zeroAddress, 1]),
      parseEther("2"),
    );
  });

  it("does not allow an account without delegated voting power to create a proposal", async function () {
    const fixture =
      await connection.networkHelpers.loadFixture(deployPostHandoffMvpFixture);

    await fixture.publicClient.waitForTransactionReceipt({
      hash: await fixture.deployer.sendTransaction({
        to: fixture.treasury.address,
        value: parseEther("1"),
      }),
    });

    const classifyCalldata = encodeFunctionData({
      abi: fixture.treasury.abi,
      functionName: "classifyCapital",
      args: [zeroAddress, 1, parseEther("1")],
    });

    const governorAsTreasuryRecipient =
      await fixture.connection.viem.getContractAt(
        "GovernanceGovernor",
        fixture.governanceGovernor.address,
        { client: { wallet: fixture.treasuryRecipient } },
      );

    await assert.rejects(
      governorAsTreasuryRecipient.write.propose([
        fixture.treasury.address,
        0n,
        classifyCalldata,
        "Treasury recipient cannot propose without votes",
      ]),
      /Governance__ProposalThresholdNotMet/,
    );
  });
});
