// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DistributionStatus} from "../shared/DistributionTypes.sol";

struct DistributionConfig {
  bytes32 distributionId;
  address asset;
  uint256 totalAmount;
}

struct ClaimRequest {
  bytes32 distributionId;
  address recipient;
  uint256 amount;
}

struct DistributionState {
  address asset;
  uint256 totalAmount;
  uint256 fundedAmount;
  uint256 claimedAmount;
  DistributionStatus status;
}
