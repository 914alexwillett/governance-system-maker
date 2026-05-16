import type { NetworkConnection } from "hardhat/types/network";
import type { Hex } from "viem";
import { getAddress, keccak256, parseEther, stringToHex, zeroAddress } from "viem";

export async function deployPreHandoffMvpFixture(
  connection: NetworkConnection,
) {
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [deployer, treasuryRecipient, distributionRecipient] =
    await viem.getWalletClients();

  if (
    deployer.account === undefined ||
    treasuryRecipient.account === undefined ||
    distributionRecipient.account === undefined
  ) {
    throw new Error("Expected default wallet clients for the fixture.");
  }

  const deployerAddress = getAddress(deployer.account.address);
  const treasuryRecipientAddress = getAddress(treasuryRecipient.account.address);
  const distributionRecipientAddress = getAddress(
    distributionRecipient.account.address,
  );

  const governanceToken = await viem.deployContract(
    "GovernanceToken",
    [
      "Fixture Governance Token",
      "FGOV",
      deployerAddress,
      deployerAddress,
      parseEther("1000000"),
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
    [60n, deployerAddress, deployerAddress, deployerAddress],
    { client: { wallet: deployer } },
  );

  const governanceGovernor = await viem.deployContract(
    "GovernanceGovernor",
    [
      "Fixture Governance Governor",
      governanceToken.address,
      governanceTimelock.address,
      1n,
      5n,
      parseEther("1000"),
      1000n,
    ],
    { client: { wallet: deployer } },
  );

  await waitForTransaction(publicClient, governanceToken.write.delegate([deployerAddress]));

  return {
    connection,
    publicClient,
    deployer,
    treasuryRecipient,
    distributionRecipient,
    deployerAddress,
    treasuryRecipientAddress,
    distributionRecipientAddress,
    governanceToken,
    treasury,
    distributor,
    governanceTimelock,
    governanceGovernor,
  };
}

export async function deployPostHandoffMvpFixture(
  connection: NetworkConnection,
) {
  const fixture = await deployPreHandoffMvpFixture(connection);

  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceTimelock.write.updateProposer([
      fixture.governanceGovernor.address,
    ]),
  );
  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceTimelock.write.updateExecutor([
      fixture.governanceGovernor.address,
    ]),
  );

  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceToken.write.transferOwnership([
      fixture.governanceTimelock.address,
    ]),
  );
  await waitForTransaction(
    fixture.publicClient,
    fixture.treasury.write.transferOwnership([fixture.governanceTimelock.address]),
  );
  await waitForTransaction(
    fixture.publicClient,
    fixture.distributor.write.transferOwnership([
      fixture.governanceTimelock.address,
    ]),
  );
  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceTimelock.write.updateAdmin([
      fixture.governanceTimelock.address,
    ]),
  );

  return fixture;
}

export async function executeGovernanceProposal(
  fixture: Awaited<ReturnType<typeof deployPostHandoffMvpFixture>>,
  proposal: {
    target: `0x${string}`;
    value?: bigint;
    data: `0x${string}`;
    description: string;
  },
) {
  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceGovernor.write.propose([
      proposal.target,
      proposal.value ?? 0n,
      proposal.data,
      proposal.description,
    ]),
  );

  const proposalId = await fixture.governanceGovernor.read.proposalCount();

  await fixture.connection.networkHelpers.mine(2);
  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceGovernor.write.castVote([proposalId, 1]),
  );

  await fixture.connection.networkHelpers.mine(6);
  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceGovernor.write.queue([proposalId]),
  );

  const minDelay = await fixture.governanceTimelock.read.minDelay();
  await fixture.connection.networkHelpers.time.increase(Number(minDelay) + 1);
  await fixture.connection.networkHelpers.mine();

  await waitForTransaction(
    fixture.publicClient,
    fixture.governanceGovernor.write.execute([proposalId]),
  );

  return proposalId;
}

export async function fundNativeTreasuryFixture(
  connection: NetworkConnection,
) {
  const fixture = await deployPreHandoffMvpFixture(connection);

  await waitForTransaction(
    fixture.publicClient,
    fixture.deployer.sendTransaction({
      to: fixture.treasury.address,
      value: parseEther("10"),
    }),
  );

  return fixture;
}

export async function fundNativeDistributorFixture(
  connection: NetworkConnection,
) {
  const fixture = await deployPreHandoffMvpFixture(connection);

  await waitForTransaction(
    fixture.publicClient,
    fixture.distributor.write.createDistribution([
      {
        distributionId: distributionId("native-happy-path"),
        asset: zeroAddress,
        totalAmount: parseEther("2"),
      },
    ]),
  );

  await waitForTransaction(
    fixture.publicClient,
    fixture.distributor.write.fundDistribution(
      [distributionId("native-happy-path"), parseEther("2")],
      { value: parseEther("2") },
    ),
  );

  const distributorAsRecipient = await fixture.connection.viem.getContractAt(
    "Distributor",
    fixture.distributor.address,
    { client: { wallet: fixture.distributionRecipient } },
  );

  return {
    ...fixture,
    distributorAsRecipient,
    fundedDistributionId: distributionId("native-happy-path"),
  };
}

export function distributionId(label: string): `0x${string}` {
  return keccak256(stringToHex(label));
}

async function waitForTransaction(
  publicClient: Awaited<ReturnType<NetworkConnection["viem"]["getPublicClient"]>>,
  txHashPromise: Promise<Hex>,
) {
  const txHash = await txHashPromise;
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}
