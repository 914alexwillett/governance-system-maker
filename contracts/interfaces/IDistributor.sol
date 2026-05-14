// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
  ClaimRequest,
  DistributionConfig
} from "../distributor/DistributorTypes.sol";

interface IDistributor {
  function createDistribution(DistributionConfig calldata config) external;

  function fundDistribution(bytes32 distributionId, uint256 amount) external;

  function claim(ClaimRequest calldata request) external;

  function fundedAmount(bytes32 distributionId) external view returns (uint256);

  function claimedAmount(
    bytes32 distributionId,
    address recipient
  ) external view returns (uint256);
}
