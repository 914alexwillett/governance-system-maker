// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CapitalClass} from "../shared/AssetTypes.sol";
import {
  Treasury__InsufficientBucketAllocation,
  Treasury__InsufficientAvailableBalance,
  Treasury__InsufficientClassifiedBalance,
  Treasury__InsufficientOperatingBalance,
  Treasury__InvalidAmount,
  Treasury__InvalidBucketId,
  Treasury__InvalidCapitalClass,
  Treasury__InvalidCapitalTransition,
  Treasury__InvalidOwner,
  Treasury__InvalidRecipient,
  Treasury__Unauthorized
} from "./TreasuryErrors.sol";
import {ITreasury} from "./ITreasury.sol";
import {BudgetAllocation, BucketSpend} from "./TreasuryTypes.sol";

interface IERC20BalanceOf {
  function balanceOf(address account) external view returns (uint256);
}

interface IERC20Transfer {
  function transfer(address to, uint256 amount) external returns (bool);
}

contract Treasury is ITreasury {
  address private constant _NATIVE_ASSET = address(0);

  struct BucketState {
    uint256 allocated;
    uint256 spent;
  }

  address public owner;

  mapping(address asset => mapping(CapitalClass classId => uint256 amount)) private _classifiedBalances;
  mapping(bytes32 bucketId => mapping(address asset => BucketState state)) private _bucketStates;
  mapping(address asset => uint256 amount) private _totalBucketCommittedByAsset;

  constructor(address initialOwner) {
    _setOwner(initialOwner);
  }

  receive() external payable {
    emit NativeAssetReceived(msg.sender, msg.value);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    _setOwner(newOwner);
  }

  function classifyCapital(address asset, CapitalClass classId, uint256 amount) external onlyOwner {
    _validateClassifiableClass(classId);
    _validateAmount(amount);

    uint256 available = unallocatedBalance(asset);
    if (available < amount) {
      revert Treasury__InsufficientAvailableBalance(asset, amount, available);
    }

    _classifiedBalances[asset][classId] += amount;
    emit CapitalClassified(asset, classId, amount);
  }

  function declassifyCapital(address asset, CapitalClass classId, uint256 amount) external onlyOwner {
    _validateClassifiableClass(classId);
    _validateAmount(amount);

    uint256 available = _availableClassifiedBalance(asset, classId);
    if (available < amount) {
      revert Treasury__InsufficientClassifiedBalance(asset, uint8(classId), amount, available);
    }

    _classifiedBalances[asset][classId] -= amount;
    emit CapitalDeclassified(asset, classId, amount);
  }

  function reclassifyCapital(
    address asset,
    CapitalClass fromClass,
    CapitalClass toClass,
    uint256 amount
  ) external onlyOwner {
    _validateClassifiableClass(fromClass);
    _validateClassifiableClass(toClass);
    _validateAmount(amount);

    if (fromClass == toClass) {
      revert Treasury__InvalidCapitalTransition(uint8(fromClass), uint8(toClass));
    }

    uint256 available = _availableClassifiedBalance(asset, fromClass);
    if (available < amount) {
      revert Treasury__InsufficientClassifiedBalance(asset, uint8(fromClass), amount, available);
    }

    _classifiedBalances[asset][fromClass] -= amount;
    _classifiedBalances[asset][toClass] += amount;

    emit CapitalReclassified(asset, fromClass, toClass, amount);
  }

  function allocateBudget(BudgetAllocation calldata allocation) external onlyOwner {
    _validateBucketId(allocation.bucketId);
    _validateAmount(allocation.amount);

    uint256 available = availableOperatingBalance(allocation.asset);
    if (available < allocation.amount) {
      revert Treasury__InsufficientOperatingBalance(
        allocation.asset,
        allocation.amount,
        available
      );
    }

    BucketState storage bucketState = _bucketStates[allocation.bucketId][allocation.asset];
    bucketState.allocated += allocation.amount;
    _totalBucketCommittedByAsset[allocation.asset] += allocation.amount;

    emit BudgetAllocated(allocation.bucketId, allocation.asset, allocation.amount);
  }

  function deallocateBudget(BudgetAllocation calldata allocation) external onlyOwner {
    _validateBucketId(allocation.bucketId);
    _validateAmount(allocation.amount);

    BucketState storage bucketState = _bucketStates[allocation.bucketId][allocation.asset];
    uint256 remaining = _bucketRemaining(bucketState);
    if (remaining < allocation.amount) {
      revert Treasury__InsufficientBucketAllocation(
        allocation.bucketId,
        allocation.asset,
        allocation.amount,
        remaining
      );
    }

    bucketState.allocated -= allocation.amount;
    _totalBucketCommittedByAsset[allocation.asset] -= allocation.amount;

    emit BudgetDeallocated(allocation.bucketId, allocation.asset, allocation.amount);
  }

  function spend(BucketSpend calldata spendRequest) external onlyOwner {
    _validateBucketId(spendRequest.bucketId);
    _validateAmount(spendRequest.amount);

    if (spendRequest.recipient == address(0)) {
      revert Treasury__InvalidRecipient(spendRequest.recipient);
    }

    BucketState storage bucketState = _bucketStates[spendRequest.bucketId][spendRequest.asset];
    uint256 remaining = _bucketRemaining(bucketState);
    if (remaining < spendRequest.amount) {
      revert Treasury__InsufficientBucketAllocation(
        spendRequest.bucketId,
        spendRequest.asset,
        spendRequest.amount,
        remaining
      );
    }

    bucketState.spent += spendRequest.amount;
    _totalBucketCommittedByAsset[spendRequest.asset] -= spendRequest.amount;
    _classifiedBalances[spendRequest.asset][CapitalClass.Operating] -= spendRequest.amount;

    _transferAsset(spendRequest.asset, spendRequest.recipient, spendRequest.amount);

    emit BucketSpent(
      spendRequest.bucketId,
      spendRequest.asset,
      spendRequest.recipient,
      spendRequest.amount
    );
  }

  function classifiedBalance(address asset, CapitalClass classId) external view returns (uint256) {
    if (classId == CapitalClass.Unclassified) {
      return unallocatedBalance(asset);
    }

    return _classifiedBalances[asset][classId];
  }

  function totalClassifiedBalance(address asset) public view returns (uint256) {
    return
      _classifiedBalances[asset][CapitalClass.Operating] +
      _classifiedBalances[asset][CapitalClass.Distributable];
  }

  function unallocatedBalance(address asset) public view returns (uint256) {
    return totalBalance(asset) - totalClassifiedBalance(asset);
  }

  function availableOperatingBalance(address asset) public view returns (uint256) {
    return _classifiedBalances[asset][CapitalClass.Operating] - _totalBucketCommittedByAsset[asset];
  }

  function totalBucketCommitted(address asset) external view returns (uint256) {
    return _totalBucketCommittedByAsset[asset];
  }

  function bucketStatus(
    bytes32 bucketId,
    address asset
  ) external view returns (uint256 allocated, uint256 spentAmount, uint256 remaining) {
    BucketState storage bucketState = _bucketStates[bucketId][asset];
    allocated = bucketState.allocated;
    spentAmount = bucketState.spent;
    remaining = allocated - spentAmount;
  }

  function totalBalance(address asset) public view returns (uint256) {
    if (_isNativeAsset(asset)) {
      return address(this).balance;
    }

    return IERC20BalanceOf(asset).balanceOf(address(this));
  }

  function _validateClassifiableClass(CapitalClass classId) internal pure {
    if (
      classId != CapitalClass.Operating &&
      classId != CapitalClass.Distributable
    ) {
      revert Treasury__InvalidCapitalClass(uint8(classId));
    }
  }

  function _validateAmount(uint256 amount) internal pure {
    if (amount == 0) {
      revert Treasury__InvalidAmount();
    }
  }

  function _validateBucketId(bytes32 bucketId) internal pure {
    if (bucketId == bytes32(0)) {
      revert Treasury__InvalidBucketId(bucketId);
    }
  }

  function _availableClassifiedBalance(
    address asset,
    CapitalClass classId
  ) internal view returns (uint256) {
    if (classId == CapitalClass.Operating) {
      return availableOperatingBalance(asset);
    }

    return _classifiedBalances[asset][classId];
  }

  function _setOwner(address newOwner) internal {
    if (newOwner == address(0)) {
      revert Treasury__InvalidOwner(newOwner);
    }

    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  function _bucketRemaining(BucketState storage bucketState) internal view returns (uint256) {
    return bucketState.allocated - bucketState.spent;
  }

  function _isNativeAsset(address asset) internal pure returns (bool) {
    return asset == _NATIVE_ASSET;
  }

  function _transferAsset(address asset, address recipient, uint256 amount) internal {
    if (_isNativeAsset(asset)) {
      (bool nativeTransferSucceeded, ) = recipient.call{value: amount}("");
      require(nativeTransferSucceeded, "Treasury: native transfer failed");
      return;
    }

    (bool erc20TransferSucceeded, bytes memory returnData) = asset.call(
      abi.encodeCall(IERC20Transfer.transfer, (recipient, amount))
    );
    require(
      erc20TransferSucceeded && (returnData.length == 0 || abi.decode(returnData, (bool))),
      "Treasury: erc20 transfer failed"
    );
  }

  modifier onlyOwner() {
    if (msg.sender != owner) {
      revert Treasury__Unauthorized(msg.sender);
    }
    _;
  }
}
