// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Governance__Unauthorized(address caller);
error Governance__InvalidOwner(address owner);
error Governance__InvalidTarget(address target);
error Governance__InvalidAmount();
error Governance__InvalidDelay(uint256 delay);
error Governance__InvalidOperation(bytes32 operationId);
error Governance__OperationAlreadyScheduled(bytes32 operationId);
error Governance__OperationNotReady(bytes32 operationId, uint256 executeAfter, uint256 currentTime);
error Governance__OperationNotScheduled(bytes32 operationId);
error Governance__InvalidVoteType(uint8 support);
error Governance__ProposalNotFound(uint256 proposalId);
error Governance__ProposalAlreadyVoted(uint256 proposalId, address voter);
error Governance__ProposalNotPending(uint256 proposalId);
error Governance__ProposalNotActive(uint256 proposalId);
error Governance__ProposalNotSucceeded(uint256 proposalId);
error Governance__ProposalNotQueued(uint256 proposalId);
error Governance__ProposalThresholdNotMet(address proposer, uint256 votes, uint256 threshold);
error Governance__InvalidVotingPeriod(uint256 votingPeriod);
error Governance__InvalidQuorumNumerator(uint256 quorumNumeratorBps);
