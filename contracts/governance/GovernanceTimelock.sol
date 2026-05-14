// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
  Governance__InvalidDelay,
  Governance__InvalidOperation,
  Governance__InvalidOwner,
  Governance__InvalidTarget,
  Governance__OperationAlreadyScheduled,
  Governance__OperationNotReady,
  Governance__OperationNotScheduled,
  Governance__Unauthorized
} from "./GovernanceErrors.sol";

contract GovernanceTimelock {
  struct Operation {
    address target;
    uint256 value;
    bytes data;
    uint256 executeAfter;
    bool executed;
  }

  address public admin;
  address public proposer;
  address public executor;
  uint256 public minDelay;

  mapping(bytes32 operationId => Operation operation) private _operations;

  event MinDelayUpdated(uint256 previousDelay, uint256 newDelay);
  event AdminUpdated(address indexed previousAdmin, address indexed newAdmin);
  event ProposerUpdated(address indexed previousProposer, address indexed newProposer);
  event ExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
  event OperationScheduled(
    bytes32 indexed operationId,
    address indexed target,
    uint256 value,
    uint256 executeAfter
  );
  event OperationCancelled(bytes32 indexed operationId);
  event OperationExecuted(bytes32 indexed operationId, address indexed target, uint256 value);

  constructor(
    uint256 initialMinDelay,
    address initialAdmin,
    address initialProposer,
    address initialExecutor
  ) {
    if (initialAdmin == address(0)) {
      revert Governance__InvalidOwner(initialAdmin);
    }
    if (initialProposer == address(0)) {
      revert Governance__InvalidOwner(initialProposer);
    }
    if (initialExecutor == address(0)) {
      revert Governance__InvalidOwner(initialExecutor);
    }

    admin = initialAdmin;
    proposer = initialProposer;
    executor = initialExecutor;
    minDelay = initialMinDelay;
  }

  receive() external payable {}

  function updateMinDelay(uint256 newMinDelay) external onlyAdmin {
    emit MinDelayUpdated(minDelay, newMinDelay);
    minDelay = newMinDelay;
  }

  function updateAdmin(address newAdmin) external onlyAdmin {
    if (newAdmin == address(0)) {
      revert Governance__InvalidOwner(newAdmin);
    }

    emit AdminUpdated(admin, newAdmin);
    admin = newAdmin;
  }

  function updateProposer(address newProposer) external onlyAdmin {
    if (newProposer == address(0)) {
      revert Governance__InvalidOwner(newProposer);
    }

    emit ProposerUpdated(proposer, newProposer);
    proposer = newProposer;
  }

  function updateExecutor(address newExecutor) external onlyAdmin {
    if (newExecutor == address(0)) {
      revert Governance__InvalidOwner(newExecutor);
    }

    emit ExecutorUpdated(executor, newExecutor);
    executor = newExecutor;
  }

  function hashOperation(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 salt
  ) public pure returns (bytes32) {
    return keccak256(abi.encode(target, value, data, salt));
  }

  function schedule(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 salt
  ) external onlyProposer returns (bytes32 operationId) {
    if (target == address(0)) {
      revert Governance__InvalidTarget(target);
    }

    operationId = hashOperation(target, value, data, salt);
    Operation storage operation = _operations[operationId];

    if (operation.executeAfter != 0 && !operation.executed) {
      revert Governance__OperationAlreadyScheduled(operationId);
    }

    uint256 executeAfter = block.timestamp + minDelay;
    _operations[operationId] = Operation({
      target: target,
      value: value,
      data: data,
      executeAfter: executeAfter,
      executed: false
    });

    emit OperationScheduled(operationId, target, value, executeAfter);
  }

  function cancel(bytes32 operationId) external onlyProposer {
    Operation storage operation = _operations[operationId];
    if (operation.executeAfter == 0 || operation.executed) {
      revert Governance__OperationNotScheduled(operationId);
    }

    delete _operations[operationId];
    emit OperationCancelled(operationId);
  }

  function execute(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 salt
  ) external payable onlyExecutor returns (bytes memory result) {
    bytes32 operationId = hashOperation(target, value, data, salt);
    Operation storage operation = _operations[operationId];

    if (operation.executeAfter == 0 || operation.executed) {
      revert Governance__OperationNotScheduled(operationId);
    }
    if (
      operation.target != target ||
      operation.value != value ||
      keccak256(operation.data) != keccak256(data)
    ) {
      revert Governance__InvalidOperation(operationId);
    }
    if (block.timestamp < operation.executeAfter) {
      revert Governance__OperationNotReady(
        operationId,
        operation.executeAfter,
        block.timestamp
      );
    }

    operation.executed = true;

    (bool success, bytes memory callResult) = target.call{value: value}(data);
    require(success, "GovernanceTimelock: execution failed");

    emit OperationExecuted(operationId, target, value);
    return callResult;
  }

  function getOperation(
    bytes32 operationId
  )
    external
    view
    returns (
      address target,
      uint256 value,
      bytes memory data,
      uint256 executeAfter,
      bool executed
    )
  {
    Operation storage operation = _operations[operationId];
    return (
      operation.target,
      operation.value,
      operation.data,
      operation.executeAfter,
      operation.executed
    );
  }

  function isOperationPending(bytes32 operationId) external view returns (bool) {
    Operation storage operation = _operations[operationId];
    return operation.executeAfter != 0 && !operation.executed;
  }

  modifier onlyAdmin() {
    if (msg.sender != admin) {
      revert Governance__Unauthorized(msg.sender);
    }
    _;
  }

  modifier onlyProposer() {
    if (msg.sender != proposer) {
      revert Governance__Unauthorized(msg.sender);
    }
    _;
  }

  modifier onlyExecutor() {
    if (msg.sender != executor) {
      revert Governance__Unauthorized(msg.sender);
    }
    _;
  }
}
