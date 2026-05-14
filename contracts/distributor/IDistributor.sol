// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DistributionStatus} from "../shared/DistributionTypes.sol";
import {ClaimRequest, DistributionConfig, DistributionState} from "./DistributorTypes.sol";

interface IDistributor {
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  event NativeAssetReceived(address indexed sender, uint256 amount);
  event DistributionCreated(
    bytes32 indexed distributionId,
    address indexed asset,
    uint256 totalAmount
  );
  event DistributionFunded(
    bytes32 indexed distributionId,
    address indexed asset,
    uint256 amount,
    uint256 fundedAmount
  );
  event DistributionClaimed(
    bytes32 indexed distributionId,
    address indexed recipient,
    uint256 amount
  );
  event DistributionClosed(bytes32 indexed distributionId);

  function owner() external view returns (address);

  function transferOwnership(address newOwner) external;

  function createDistribution(DistributionConfig calldata config) external;

  function fundDistribution(bytes32 distributionId, uint256 amount) external payable;

  function claim(ClaimRequest calldata request) external;

  function fundedAmount(bytes32 distributionId) external view returns (uint256);

  function claimedAmount(bytes32 distributionId, address recipient) external view returns (uint256);

  function distributionState(
    bytes32 distributionId
  ) external view returns (DistributionState memory);

  function totalOutstandingForAsset(address asset) external view returns (uint256);

  function distributionStatus(bytes32 distributionId) external view returns (DistributionStatus);
}
