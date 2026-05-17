// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Distributor__InvalidOwner(address owner);
error Distributor__InvalidDistributionId(bytes32 distributionId);
error Distributor__DistributionAlreadyExists(bytes32 distributionId);
error Distributor__InvalidRecipient(address recipient);
error Distributor__InvalidAmount();
error Distributor__Unauthorized(address caller);
error Distributor__DistributionNotFunded(bytes32 distributionId);
error Distributor__FundingExceedsDistributionAmount(
  bytes32 distributionId,
  uint256 requested,
  uint256 remaining
);
error Distributor__InsufficientAvailableBalance(address asset, uint256 required, uint256 available);
error Distributor__ClaimExceedsFundedAmount(bytes32 distributionId, uint256 requested, uint256 available);
error Distributor__ClaimAlreadyProcessed(bytes32 distributionId, address recipient);
