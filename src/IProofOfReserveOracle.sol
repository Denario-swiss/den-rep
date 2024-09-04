//SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

interface IProofOfReserveOracle {
	function lockedValue() external view returns (uint256);
}
