// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
// This is a template contract for upgrading the original DSC contract

pragma solidity ^0.8.27;

import "./ERC20WithFeesUpgradeable.sol";

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DSCV2 is ERC20WithFeesUpgradeable, UUPSUpgradeable {
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function version() public pure returns (string memory) {
		return "2.0.0";
	}

	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

	// TODO: do not mutate the name but the version string
	// function name() public pure override returns (string memory) {
	// 	return "DSC";
	// }
}
