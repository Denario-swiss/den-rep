// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
// This is a template contract for upgrading the original DSC contract

pragma solidity ^0.8.27;

import "./ERC20WithFeesUpgradeableV2.sol";

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DenarioGoldV2 is ERC20WithFeesUpgradeableV2, UUPSUpgradeable {
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function version() public pure returns (int8) {
		return 2;
	}

	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
