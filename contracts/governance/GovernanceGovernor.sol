// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
  Governance__InvalidQuorumNumerator,
  Governance__InvalidTarget,
  Governance__InvalidVotingPeriod,
  Governance__InvalidVoteType,
  Governance__ProposalAlreadyVoted,
  Governance__ProposalNotActive,
  Governance__ProposalNotFound,
  Governance__ProposalNotPending,
  Governance__ProposalNotQueued,
  Governance__ProposalNotSucceeded,
  Governance__ProposalThresholdNotMet,
  Governance__Unauthorized
} from "./GovernanceErrors.sol";
import {GovernanceTimelock} from "./GovernanceTimelock.sol";
import {IGovernanceToken} from "../interfaces/IGovernanceToken.sol";

contract GovernanceGovernor {
  enum ProposalState {
    Pending,
    Active,
    Defeated,
    Succeeded,
    Queued,
    Executed,
    Canceled
  }

  struct ProposalCore {
    address proposer;
    address target;
    uint256 value;
    uint48 snapshot;
    uint48 deadline;
    uint256 forVotes;
    uint256 againstVotes;
    uint256 abstainVotes;
    bool queued;
    bool executed;
    bool canceled;
  }

  struct Receipt {
    bool hasVoted;
    uint8 support;
    uint256 votes;
  }

  string public name;
  IGovernanceToken public immutable token;
  GovernanceTimelock public immutable timelock;
  uint48 public immutable votingDelay;
  uint48 public immutable votingPeriod;
  uint256 public immutable proposalThreshold;
  uint256 public immutable quorumNumeratorBps;

  uint256 private _proposalCount;

  mapping(uint256 proposalId => ProposalCore proposal) private _proposals;
  mapping(uint256 proposalId => bytes proposalData) private _proposalCalldatas;
  mapping(uint256 proposalId => bytes32 descriptionHash) private _proposalDescriptionHashes;
  mapping(uint256 proposalId => mapping(address voter => Receipt receipt)) private _receipts;

  event ProposalCreated(
    uint256 indexed proposalId,
    address indexed proposer,
    address indexed target,
    uint256 value,
    uint48 snapshot,
    uint48 deadline,
    string description
  );
  event VoteCast(
    address indexed voter,
    uint256 indexed proposalId,
    uint8 support,
    uint256 weight
  );
  event ProposalQueued(uint256 indexed proposalId, bytes32 indexed operationId);
  event ProposalExecuted(uint256 indexed proposalId, bytes32 indexed operationId);
  event ProposalCanceled(uint256 indexed proposalId);

  constructor(
    string memory name_,
    address tokenAddress,
    address timelockAddress,
    uint48 votingDelay_,
    uint48 votingPeriod_,
    uint256 proposalThreshold_,
    uint256 quorumNumeratorBps_
  ) {
    if (tokenAddress == address(0)) {
      revert Governance__InvalidTarget(tokenAddress);
    }
    if (timelockAddress == address(0)) {
      revert Governance__InvalidTarget(timelockAddress);
    }
    if (votingPeriod_ == 0) {
      revert Governance__InvalidVotingPeriod(votingPeriod_);
    }
    if (quorumNumeratorBps_ > 10_000) {
      revert Governance__InvalidQuorumNumerator(quorumNumeratorBps_);
    }

    name = name_;
    token = IGovernanceToken(tokenAddress);
    timelock = GovernanceTimelock(payable(timelockAddress));
    votingDelay = votingDelay_;
    votingPeriod = votingPeriod_;
    proposalThreshold = proposalThreshold_;
    quorumNumeratorBps = quorumNumeratorBps_;
  }

  function propose(
    address target,
    uint256 value,
    bytes calldata data,
    string calldata description
  ) external returns (uint256 proposalId) {
    if (target == address(0)) {
      revert Governance__InvalidTarget(target);
    }

    uint256 proposerVotes = token.getVotes(msg.sender);
    if (proposerVotes < proposalThreshold) {
      revert Governance__ProposalThresholdNotMet(
        msg.sender,
        proposerVotes,
        proposalThreshold
      );
    }

    proposalId = ++_proposalCount;
    uint48 snapshot = clock() + votingDelay;
    uint48 deadline = snapshot + votingPeriod;

    _proposals[proposalId] = ProposalCore({
      proposer: msg.sender,
      target: target,
      value: value,
      snapshot: snapshot,
      deadline: deadline,
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      queued: false,
      executed: false,
      canceled: false
    });
    _proposalCalldatas[proposalId] = data;
    _proposalDescriptionHashes[proposalId] = keccak256(bytes(description));

    emit ProposalCreated(
      proposalId,
      msg.sender,
      target,
      value,
      snapshot,
      deadline,
      description
    );
  }

  function castVote(uint256 proposalId, uint8 support) external returns (uint256 weight) {
    ProposalCore storage proposal = _requireProposal(proposalId);

    if (state(proposalId) != ProposalState.Active) {
      revert Governance__ProposalNotActive(proposalId);
    }
    if (support > 2) {
      revert Governance__InvalidVoteType(support);
    }

    Receipt storage receipt = _receipts[proposalId][msg.sender];
    if (receipt.hasVoted) {
      revert Governance__ProposalAlreadyVoted(proposalId, msg.sender);
    }

    weight = token.getPastVotes(msg.sender, proposal.snapshot);

    receipt.hasVoted = true;
    receipt.support = support;
    receipt.votes = weight;

    if (support == 0) {
      proposal.againstVotes += weight;
    } else if (support == 1) {
      proposal.forVotes += weight;
    } else {
      proposal.abstainVotes += weight;
    }

    emit VoteCast(msg.sender, proposalId, support, weight);
  }

  function queue(uint256 proposalId) external returns (bytes32 operationId) {
    if (state(proposalId) != ProposalState.Succeeded) {
      revert Governance__ProposalNotSucceeded(proposalId);
    }

    ProposalCore storage proposal = _proposals[proposalId];
    bytes memory data = _proposalCalldatas[proposalId];
    bytes32 salt = _timelockSalt(proposalId);
    operationId = timelock.hashOperation(proposal.target, proposal.value, data, salt);

    proposal.queued = true;
    timelock.schedule(proposal.target, proposal.value, data, salt);

    emit ProposalQueued(proposalId, operationId);
  }

  function execute(uint256 proposalId) external returns (bytes memory result) {
    if (state(proposalId) != ProposalState.Queued) {
      revert Governance__ProposalNotQueued(proposalId);
    }

    ProposalCore storage proposal = _proposals[proposalId];
    bytes memory data = _proposalCalldatas[proposalId];
    bytes32 salt = _timelockSalt(proposalId);
    bytes32 operationId = timelock.hashOperation(proposal.target, proposal.value, data, salt);

    proposal.executed = true;
    result = timelock.execute(
      proposal.target,
      proposal.value,
      data,
      salt
    );

    emit ProposalExecuted(proposalId, operationId);
  }

  function cancel(uint256 proposalId) external {
    ProposalCore storage proposal = _requireProposal(proposalId);

    if (proposal.proposer != msg.sender) {
      revert Governance__Unauthorized(msg.sender);
    }

    ProposalState proposalState = state(proposalId);
    if (
      proposalState != ProposalState.Pending &&
      proposalState != ProposalState.Active &&
      proposalState != ProposalState.Succeeded
    ) {
      revert Governance__ProposalNotPending(proposalId);
    }

    proposal.canceled = true;

    if (proposal.queued) {
      bytes32 operationId = timelock.hashOperation(
        proposal.target,
        proposal.value,
        _proposalCalldatas[proposalId],
        _timelockSalt(proposalId)
      );
      timelock.cancel(operationId);
    }

    emit ProposalCanceled(proposalId);
  }

  function state(uint256 proposalId) public view returns (ProposalState) {
    ProposalCore storage proposal = _requireProposal(proposalId);

    if (proposal.canceled) {
      return ProposalState.Canceled;
    }
    if (proposal.executed) {
      return ProposalState.Executed;
    }
    if (proposal.queued) {
      return ProposalState.Queued;
    }

    uint48 currentTimepoint = clock();
    if (currentTimepoint <= proposal.snapshot) {
      return ProposalState.Pending;
    }
    if (currentTimepoint <= proposal.deadline) {
      return ProposalState.Active;
    }
    if (
      proposal.forVotes < quorum(proposal.snapshot) ||
      proposal.forVotes <= proposal.againstVotes
    ) {
      return ProposalState.Defeated;
    }

    return ProposalState.Succeeded;
  }

  function quorum(uint256 timepoint) public view returns (uint256) {
    return (token.getPastTotalSupply(timepoint) * quorumNumeratorBps) / 10_000;
  }

  function clock() public view returns (uint48) {
    return token.clock();
  }

  function proposalCount() external view returns (uint256) {
    return _proposalCount;
  }

  function proposalSnapshot(uint256 proposalId) external view returns (uint256) {
    return _requireProposal(proposalId).snapshot;
  }

  function proposalDeadline(uint256 proposalId) external view returns (uint256) {
    return _requireProposal(proposalId).deadline;
  }

  function proposalVotes(
    uint256 proposalId
  ) external view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) {
    ProposalCore storage proposal = _requireProposal(proposalId);
    return (proposal.againstVotes, proposal.forVotes, proposal.abstainVotes);
  }

  function proposalReceipt(
    uint256 proposalId,
    address voter
  ) external view returns (Receipt memory) {
    _requireProposal(proposalId);
    return _receipts[proposalId][voter];
  }

  function proposalDetails(
    uint256 proposalId
  )
    external
    view
    returns (
      address proposer,
      address target,
      uint256 value,
      bytes memory data,
      bytes32 descriptionHash,
      ProposalState proposalState
    )
  {
    ProposalCore storage proposal = _requireProposal(proposalId);
    return (
      proposal.proposer,
      proposal.target,
      proposal.value,
      _proposalCalldatas[proposalId],
      _proposalDescriptionHashes[proposalId],
      state(proposalId)
    );
  }

  function _timelockSalt(uint256 proposalId) internal pure returns (bytes32) {
    return bytes32(proposalId);
  }

  function _requireProposal(
    uint256 proposalId
  ) internal view returns (ProposalCore storage proposal) {
    proposal = _proposals[proposalId];
    if (proposal.proposer == address(0)) {
      revert Governance__ProposalNotFound(proposalId);
    }
  }
}
