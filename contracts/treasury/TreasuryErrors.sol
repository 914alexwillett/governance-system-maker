// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Treasury__InvalidOwner(address owner);
error Treasury__InvalidBucketId(bytes32 bucketId);
error Treasury__InvalidRecipient(address recipient);
error Treasury__InvalidAmount();
error Treasury__InvalidCapitalClass(uint8 classId);
error Treasury__InvalidCapitalTransition(uint8 fromClass, uint8 toClass);
error Treasury__InsufficientAvailableBalance(address asset, uint256 required, uint256 available);
error Treasury__InsufficientClassifiedBalance(address asset, uint8 classId, uint256 required, uint256 available);
error Treasury__InsufficientOperatingBalance(address asset, uint256 required, uint256 available);
error Treasury__InsufficientBucketAllocation(bytes32 bucketId, address asset, uint256 required, uint256 available);
error Treasury__Unauthorized(address caller);
