// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import "./ERC20WithFeesUpgradeable.sol";

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DSCV2 is ERC20WithFeesUpgradeable, UUPSUpgradeable {
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

	function name() public pure override returns (string memory) {
		return "Denario Silver Coin";
	}
}
