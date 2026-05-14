// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CapitalClass} from "../shared/AssetTypes.sol";
import {BudgetAllocation, BucketSpend} from "./TreasuryTypes.sol";

interface ITreasury {
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  event NativeAssetReceived(address indexed sender, uint256 amount);
  event CapitalClassified(address indexed asset, CapitalClass indexed classId, uint256 amount);
  event CapitalDeclassified(address indexed asset, CapitalClass indexed classId, uint256 amount);
  event CapitalReclassified(
    address indexed asset,
    CapitalClass indexed fromClass,
    CapitalClass indexed toClass,
    uint256 amount
  );
  event BudgetAllocated(bytes32 indexed bucketId, address indexed asset, uint256 amount);
  event BudgetDeallocated(bytes32 indexed bucketId, address indexed asset, uint256 amount);
  event BucketSpent(
    bytes32 indexed bucketId,
    address indexed asset,
    address indexed recipient,
    uint256 amount
  );

  function owner() external view returns (address);

  function transferOwnership(address newOwner) external;

  function classifyCapital(address asset, CapitalClass classId, uint256 amount) external;

  function declassifyCapital(address asset, CapitalClass classId, uint256 amount) external;

  function reclassifyCapital(
    address asset,
    CapitalClass fromClass,
    CapitalClass toClass,
    uint256 amount
  ) external;

  function allocateBudget(BudgetAllocation calldata allocation) external;

  function deallocateBudget(BudgetAllocation calldata allocation) external;

  function spend(BucketSpend calldata spendRequest) external;

  function classifiedBalance(address asset, CapitalClass classId) external view returns (uint256);

  function totalClassifiedBalance(address asset) external view returns (uint256);

  function unallocatedBalance(address asset) external view returns (uint256);

  function availableOperatingBalance(address asset) external view returns (uint256);

  function totalBucketCommitted(address asset) external view returns (uint256);

  function bucketStatus(
    bytes32 bucketId,
    address asset
  ) external view returns (uint256 allocated, uint256 spentAmount, uint256 remaining);

  function totalBalance(address asset) external view returns (uint256);
}
