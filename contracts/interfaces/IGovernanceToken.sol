// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IGovernanceToken {
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
  event GovernanceMint(address indexed to, uint256 amount);
  event GovernanceBurn(address indexed from, uint256 amount);
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  event DelegateChanged(
    address indexed delegator,
    address indexed fromDelegate,
    address indexed toDelegate
  );
  event DelegateVotesChanged(
    address indexed delegate,
    uint256 previousVotes,
    uint256 newVotes
  );

  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function decimals() external pure returns (uint8);

  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function allowance(address owner, address spender) external view returns (uint256);

  function owner() external view returns (address);

  function transfer(address to, uint256 amount) external returns (bool);

  function approve(address spender, uint256 amount) external returns (bool);

  function transferFrom(address from, address to, uint256 amount) external returns (bool);

  function mint(address to, uint256 amount) external;

  function burn(address from, uint256 amount) external;

  function transferOwnership(address newOwner) external;

  function delegate(address delegatee) external;

  function delegates(address account) external view returns (address);

  function getVotes(address account) external view returns (uint256);

  function getPastVotes(address account, uint256 timepoint) external view returns (uint256);

  function getPastTotalSupply(uint256 timepoint) external view returns (uint256);

  function clock() external view returns (uint48);

  function CLOCK_MODE() external pure returns (string memory);
}
