// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Governance__InvalidAmount, Governance__InvalidOwner, Governance__Unauthorized} from "./GovernanceErrors.sol";
import {IGovernanceToken} from "../interfaces/IGovernanceToken.sol";

contract GovernanceToken is IGovernanceToken {
  struct Checkpoint {
    uint48 fromBlock;
    uint208 votes;
  }

  string public name;
  string public symbol;

  uint256 public totalSupply;
  address public owner;

  mapping(address account => uint256) public balanceOf;
  mapping(address account => mapping(address spender => uint256)) public allowance;
  mapping(address account => address) private _delegates;
  mapping(address account => Checkpoint[]) private _delegateCheckpoints;
  Checkpoint[] private _totalSupplyCheckpoints;

  constructor(
    string memory name_,
    string memory symbol_,
    address initialOwner,
    address initialRecipient,
    uint256 initialSupply
  ) {
    if (initialOwner == address(0)) {
      revert Governance__InvalidOwner(initialOwner);
    }

    name = name_;
    symbol = symbol_;
    owner = initialOwner;

    emit OwnershipTransferred(address(0), initialOwner);

    if (initialSupply > 0) {
      if (initialRecipient == address(0)) {
        revert Governance__InvalidOwner(initialRecipient);
      }

      _mint(initialRecipient, initialSupply);
    }
  }

  function decimals() public pure returns (uint8) {
    return 18;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    _transfer(msg.sender, to, amount);
    return true;
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    uint256 currentAllowance = allowance[from][msg.sender];

    if (currentAllowance != type(uint256).max) {
      allowance[from][msg.sender] = currentAllowance - amount;
      emit Approval(from, msg.sender, allowance[from][msg.sender]);
    }

    _transfer(from, to, amount);
    return true;
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external onlyOwner {
    _burn(from, amount);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    if (newOwner == address(0)) {
      revert Governance__InvalidOwner(newOwner);
    }

    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  function delegate(address delegatee) external {
    _delegate(msg.sender, delegatee);
  }

  function delegates(address account) external view returns (address) {
    return _delegates[account];
  }

  function getVotes(address account) external view returns (uint256) {
    return _checkpointLookup(_delegateCheckpoints[account], clock());
  }

  function getPastVotes(address account, uint256 timepoint) external view returns (uint256) {
    return _checkpointLookup(_delegateCheckpoints[account], _validateTimepoint(timepoint));
  }

  function getPastTotalSupply(uint256 timepoint) external view returns (uint256) {
    return _checkpointLookup(_totalSupplyCheckpoints, _validateTimepoint(timepoint));
  }

  function clock() public view returns (uint48) {
    return uint48(block.number);
  }

  function CLOCK_MODE() external pure returns (string memory) {
    return "mode=blocknumber&from=default";
  }

  function _transfer(address from, address to, uint256 amount) internal {
    if (to == address(0)) {
      revert Governance__InvalidOwner(to);
    }
    if (amount == 0) {
      revert Governance__InvalidAmount();
    }

    balanceOf[from] -= amount;
    balanceOf[to] += amount;

    emit Transfer(from, to, amount);

    _moveVotingPower(_delegates[from], _delegates[to], amount);
  }

  function _approve(address tokenOwner, address spender, uint256 amount) internal {
    if (spender == address(0)) {
      revert Governance__InvalidOwner(spender);
    }

    allowance[tokenOwner][spender] = amount;
    emit Approval(tokenOwner, spender, amount);
  }

  function _mint(address to, uint256 amount) internal {
    if (to == address(0)) {
      revert Governance__InvalidOwner(to);
    }
    if (amount == 0) {
      revert Governance__InvalidAmount();
    }

    totalSupply += amount;
    balanceOf[to] += amount;

    emit Transfer(address(0), to, amount);
    emit GovernanceMint(to, amount);

    _writeCheckpoint(_totalSupplyCheckpoints, totalSupply);
    _moveVotingPower(address(0), _delegates[to], amount);
  }

  function _burn(address from, uint256 amount) internal {
    if (from == address(0)) {
      revert Governance__InvalidOwner(from);
    }
    if (amount == 0) {
      revert Governance__InvalidAmount();
    }

    balanceOf[from] -= amount;
    totalSupply -= amount;

    emit Transfer(from, address(0), amount);
    emit GovernanceBurn(from, amount);

    _writeCheckpoint(_totalSupplyCheckpoints, totalSupply);
    _moveVotingPower(_delegates[from], address(0), amount);
  }

  function _delegate(address account, address delegatee) internal {
    address currentDelegate = _delegates[account];
    _delegates[account] = delegatee;

    emit DelegateChanged(account, currentDelegate, delegatee);

    _moveVotingPower(currentDelegate, delegatee, balanceOf[account]);
  }

  function _moveVotingPower(address from, address to, uint256 amount) internal {
    if (from == to || amount == 0) {
      return;
    }

    if (from != address(0)) {
      uint256 oldFromVotes = _checkpointLookup(_delegateCheckpoints[from], clock());
      uint256 newFromVotes = oldFromVotes - amount;
      _writeCheckpoint(_delegateCheckpoints[from], newFromVotes);
      emit DelegateVotesChanged(from, oldFromVotes, newFromVotes);
    }

    if (to != address(0)) {
      uint256 oldToVotes = _checkpointLookup(_delegateCheckpoints[to], clock());
      uint256 newToVotes = oldToVotes + amount;
      _writeCheckpoint(_delegateCheckpoints[to], newToVotes);
      emit DelegateVotesChanged(to, oldToVotes, newToVotes);
    }
  }

  function _writeCheckpoint(Checkpoint[] storage checkpoints, uint256 votes) internal {
    uint48 currentBlock = clock();
    uint208 safeVotes = _safeCastTo208(votes);
    uint256 length = checkpoints.length;

    if (length > 0 && checkpoints[length - 1].fromBlock == currentBlock) {
      checkpoints[length - 1].votes = safeVotes;
      return;
    }

    checkpoints.push(Checkpoint({fromBlock: currentBlock, votes: safeVotes}));
  }

  function _checkpointLookup(
    Checkpoint[] storage checkpoints,
    uint48 timepoint
  ) internal view returns (uint256) {
    uint256 length = checkpoints.length;

    if (length == 0) {
      return 0;
    }

    uint256 low = 0;
    uint256 high = length;

    while (low < high) {
      uint256 mid = (low + high) / 2;

      if (checkpoints[mid].fromBlock > timepoint) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    if (high == 0) {
      return 0;
    }

    return checkpoints[high - 1].votes;
  }

  function _validateTimepoint(uint256 timepoint) internal view returns (uint48) {
    uint48 currentBlock = clock();

    if (timepoint >= currentBlock) {
      revert Governance__Unauthorized(msg.sender);
    }

    return uint48(timepoint);
  }

  function _safeCastTo208(uint256 value) internal pure returns (uint208) {
    require(value <= type(uint208).max, "GovernanceToken: vote overflow");
    return uint208(value);
  }

  modifier onlyOwner() {
    if (msg.sender != owner) {
      revert Governance__Unauthorized(msg.sender);
    }
    _;
  }
}
