// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DistributionStatus} from "../shared/DistributionTypes.sol";
import {
  Distributor__ClaimAlreadyProcessed,
  Distributor__ClaimExceedsFundedAmount,
  Distributor__DistributionAlreadyExists,
  Distributor__DistributionNotFunded,
  Distributor__FundingExceedsDistributionAmount,
  Distributor__InsufficientAvailableBalance,
  Distributor__InvalidAmount,
  Distributor__InvalidDistributionId,
  Distributor__InvalidOwner,
  Distributor__InvalidRecipient,
  Distributor__Unauthorized
} from "./DistributorErrors.sol";
import {IDistributor} from "./IDistributor.sol";
import {ClaimRequest, DistributionConfig, DistributionState} from "./DistributorTypes.sol";

interface IERC20BalanceReader {
  function balanceOf(address account) external view returns (uint256);
}

interface IERC20Transfer {
  function transfer(address to, uint256 amount) external returns (bool);
}

contract Distributor is IDistributor {
  address public owner;

  mapping(bytes32 distributionId => DistributionState state) private _distributionStates;
  mapping(bytes32 distributionId => mapping(address recipient => uint256 amount)) private _claimedAmounts;
  mapping(address asset => uint256 amount) private _totalOutstandingByAsset;

  constructor(address initialOwner) {
    if (initialOwner == address(0)) {
      revert Distributor__InvalidOwner(initialOwner);
    }

    owner = initialOwner;
    emit OwnershipTransferred(address(0), initialOwner);
  }

  receive() external payable {
    emit NativeAssetReceived(msg.sender, msg.value);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    if (newOwner == address(0)) {
      revert Distributor__InvalidOwner(newOwner);
    }

    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  function createDistribution(DistributionConfig calldata config) external onlyOwner {
    if (config.distributionId == bytes32(0)) {
      revert Distributor__InvalidDistributionId(config.distributionId);
    }
    if (config.totalAmount == 0) {
      revert Distributor__InvalidAmount();
    }

    DistributionState storage currentState = _distributionStates[config.distributionId];
    if (currentState.totalAmount != 0) {
      revert Distributor__DistributionAlreadyExists(config.distributionId);
    }

    _distributionStates[config.distributionId] = DistributionState({
      asset: config.asset,
      totalAmount: config.totalAmount,
      fundedAmount: 0,
      claimedAmount: 0,
      status: DistributionStatus.None
    });

    emit DistributionCreated(config.distributionId, config.asset, config.totalAmount);
  }

  function fundDistribution(bytes32 distributionId, uint256 amount) external payable onlyOwner {
    DistributionState storage state = _requireDistribution(distributionId);
    _validateAmount(amount);

    uint256 remainingCapacity = state.totalAmount - state.fundedAmount;
    if (remainingCapacity < amount) {
      revert Distributor__FundingExceedsDistributionAmount(
        distributionId,
        amount,
        remainingCapacity
      );
    }

    if (state.asset == address(0) && msg.value > 0 && msg.value != amount) {
      revert Distributor__InvalidAmount();
    }

    uint256 available = _availableUnfundedBalance(state.asset);
    if (available < amount) {
      revert Distributor__InsufficientAvailableBalance(state.asset, amount, available);
    }

    state.fundedAmount += amount;
    state.status = DistributionStatus.Funded;
    _totalOutstandingByAsset[state.asset] += amount;

    emit DistributionFunded(distributionId, state.asset, amount, state.fundedAmount);
  }

  function claim(ClaimRequest calldata request) external {
    DistributionState storage state = _requireDistribution(request.distributionId);
    _validateAmount(request.amount);

    if (request.recipient == address(0)) {
      revert Distributor__InvalidRecipient(request.recipient);
    }
    if (request.recipient != msg.sender) {
      revert Distributor__Unauthorized(msg.sender);
    }
    if (state.status != DistributionStatus.Funded) {
      revert Distributor__DistributionNotFunded(request.distributionId);
    }
    if (_claimedAmounts[request.distributionId][request.recipient] != 0) {
      revert Distributor__ClaimAlreadyProcessed(
        request.distributionId,
        request.recipient
      );
    }

    uint256 available = state.fundedAmount - state.claimedAmount;
    if (available < request.amount) {
      revert Distributor__ClaimExceedsFundedAmount(
        request.distributionId,
        request.amount,
        available
      );
    }

    _claimedAmounts[request.distributionId][request.recipient] = request.amount;
    state.claimedAmount += request.amount;
    _totalOutstandingByAsset[state.asset] -= request.amount;

    _transferAsset(state.asset, request.recipient, request.amount);

    emit DistributionClaimed(request.distributionId, request.recipient, request.amount);

    if (state.claimedAmount == state.fundedAmount) {
      state.status = DistributionStatus.Closed;
      emit DistributionClosed(request.distributionId);
    }
  }

  function fundedAmount(bytes32 distributionId) external view returns (uint256) {
    return _distributionStates[distributionId].fundedAmount;
  }

  function claimedAmount(
    bytes32 distributionId,
    address recipient
  ) external view returns (uint256) {
    return _claimedAmounts[distributionId][recipient];
  }

  function distributionState(
    bytes32 distributionId
  ) external view returns (DistributionState memory) {
    return _requireDistribution(distributionId);
  }

  function totalOutstandingForAsset(address asset) external view returns (uint256) {
    return _totalOutstandingByAsset[asset];
  }

  function distributionStatus(bytes32 distributionId) external view returns (DistributionStatus) {
    return _requireDistribution(distributionId).status;
  }

  function _availableUnfundedBalance(address asset) internal view returns (uint256) {
    return _totalBalance(asset) - _totalOutstandingByAsset[asset];
  }

  function _totalBalance(address asset) internal view returns (uint256) {
    if (asset == address(0)) {
      return address(this).balance;
    }

    return IERC20BalanceReader(asset).balanceOf(address(this));
  }

  function _requireDistribution(
    bytes32 distributionId
  ) internal view returns (DistributionState storage state) {
    if (distributionId == bytes32(0)) {
      revert Distributor__InvalidDistributionId(distributionId);
    }

    state = _distributionStates[distributionId];
    if (state.totalAmount == 0) {
      revert Distributor__InvalidDistributionId(distributionId);
    }
  }

  function _transferAsset(address asset, address recipient, uint256 amount) internal {
    if (asset == address(0)) {
      (bool nativeTransferSucceeded, ) = recipient.call{value: amount}("");
      require(nativeTransferSucceeded, "Distributor: native transfer failed");
      return;
    }

    (bool erc20TransferSucceeded, bytes memory returnData) = asset.call(
      abi.encodeCall(IERC20Transfer.transfer, (recipient, amount))
    );
    require(
      erc20TransferSucceeded && (returnData.length == 0 || abi.decode(returnData, (bool))),
      "Distributor: erc20 transfer failed"
    );
  }

  function _validateAmount(uint256 amount) internal pure {
    if (amount == 0) {
      revert Distributor__InvalidAmount();
    }
  }

  modifier onlyOwner() {
    if (msg.sender != owner) {
      revert Distributor__Unauthorized(msg.sender);
    }
    _;
  }
}
