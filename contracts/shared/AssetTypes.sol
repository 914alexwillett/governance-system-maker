// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum AssetKind {
  Native,
  ERC20
}

enum CapitalClass {
  Unclassified,
  Operating,
  Distributable
}

struct AssetAmount {
  address asset;
  uint256 amount;
  AssetKind kind;
}

struct CapitalAllocation {
  address asset;
  uint256 amount;
  CapitalClass classId;
}
