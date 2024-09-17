// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import "./IProofOfReserveOracle.sol";

interface IERC20WithFeesUpgradeableErrors {
	/**
	 * @dev Indicates an error while modifying the fee.
	 * @param maxFee Maximum fee that is allowed.
	 */
	error MaxFeeExceeded(uint256 maxFee);

	/**
	 * @dev Indicates an while decreasing the allowance below zero.
	 */
	error AllowanceBelowZero();

	/**
	 * @dev Indicates that the address cannot be the minter.
	 * @param minter Address that was attempted to be set as the minter.
	 */
	error InvalidMiner(address minter);

	/**
	 * @dev Indicates a failure with the token `sender`. Used in minting.
	 * @param sender Address that attempted to mint tokens.
	 */
	error NotMinter(address sender);

	/**
	 * @dev Indicates that the address cannot be the oracle.
	 * @param oracle Address that was attempted to be set as the oracle.
	 */
	error InvalidOracle(address oracle);

	/**
	 * @dev Indicates that the address cannot be the fee collector.
	 * @param  feeCollector Address that was attempted to be set as the fee collector.
	 */
	error InvalidFeeCollector(address feeCollector);

	/**
	 * @dev Indicates a failure during minting, duw to the Oracle reporting a reserve balance that is too low.
	 * @param reserve Address that attempted to set the fee recipient.
	 */
	error MintingLimitExceeded(uint256 reserve);

	/**
	 * @dev Indicates a failure when attempting to update the fee rate.
	 * @param minDelay Minimum delay that must be elapsed before the fee rate can be updated.
	 */
	error FeeChangeTooSoon(uint256 minDelay);
}
