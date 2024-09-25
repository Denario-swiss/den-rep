// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import "./ERC20WithFeesUpgradeable.sol";

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DSC is ERC20WithFeesUpgradeable, UUPSUpgradeable {
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize(
		address _ownerAddress,
		string memory _name,
		string memory _symbol,
		uint256 _fee,
		uint256 _maxFee,
		uint256 _delayFeeUpdate,
		address _feeCollectionAddress,
		address _minterAddress
	) public initializer {
		__ERC20WithFees_init(
			_ownerAddress,
			_name,
			_symbol,
			_fee,
			_maxFee,
			_delayFeeUpdate,
			_feeCollectionAddress,
			_minterAddress
		);
	}

	function version() public pure returns (int8) {
		return 1;
	}

	function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
