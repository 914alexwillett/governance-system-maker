// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct BudgetAllocation {
  bytes32 bucketId;
  address asset;
  uint256 amount;
}

struct BucketSpend {
  bytes32 bucketId;
  address asset;
  address recipient;
  uint256 amount;
}

struct DistributorFundingRequest {
  bytes32 distributionId;
  address distributor;
  address asset;
  uint256 amount;
}
