// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CapitalClass} from "../shared/AssetTypes.sol";
import {
  BudgetAllocation,
  BucketSpend,
  DistributorFundingRequest
} from "../treasury/TreasuryTypes.sol";

interface ITreasury {
  function classifyCapital(
    address asset,
    CapitalClass classId,
    uint256 amount
  ) external;

  function allocateBudget(BudgetAllocation calldata allocation) external;

  function spend(BucketSpend calldata spendRequest) external;

  function fundDistribution(
    DistributorFundingRequest calldata fundingRequest
  ) external;

  function availableBalance(address asset) external view returns (uint256);

  function bucketStatus(
    bytes32 bucketId,
    address asset
  ) external view returns (uint256 allocated, uint256 spentAmount);
}
