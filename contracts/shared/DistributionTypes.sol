// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum DistributionStatus {
  None,
  Funded,
  Closed
}

struct DistributionFunding {
  bytes32 distributionId;
  address asset;
  uint256 amount;
}
