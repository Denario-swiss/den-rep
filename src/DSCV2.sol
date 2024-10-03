// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
// This is a template contract for upgrading the original DSC contract

pragma solidity ^0.8.27;

import "./ERC20WithFeesUpgradeable.sol";
import "./DSC.sol";

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DSCV2 is ERC20WithFeesUpgradeable, UUPSUpgradeable {
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	bytes32 private constant ERC20StorageLocation = 0x84f93370f668d60ff19344e905d5e5ea70bb94f6b70992c58975d1579ea05400;

	function _getStorage() private pure returns (ERC20WithFeesStorage storage $) {
		assembly {
			$.slot := ERC20StorageLocation
		}
	}

	// expensively overwrite the feeRate
	function reduceFeeRate(uint256 newFeeRate) public onlyOwner {
		ERC20WithFeesStorage storage erc20Storage = _getStorage();
		require(newFeeRate <= erc20Storage.feeRate, "New fee must be lower than current fee");
		erc20Storage.feeRate = newFeeRate;
	}

	function version() public pure returns (int8) {
		return 2;
	}

	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
