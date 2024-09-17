// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { IProofOfReserveOracle } from "./IProofOfReserveOracle.sol";
import { IERC20WithFeesUpgradeableErrors } from "./IERC20WithFeesUpgradeableErrors.sol";

abstract contract ERC20WithFeesUpgradeable is
	ERC20Upgradeable,
	Ownable2StepUpgradeable,
	IERC20WithFeesUpgradeableErrors
{
	event FeeChanged(uint256 newFee);
	event OracleAddressChanged(address oracle);

	/// @custom:storage-location erc7201:storage.ERC20WithFeesStorage
	struct ERC20WithFeesStorage {
		address oracle;
		mapping(address => uint256) _feeLastPaid;
		mapping(address => bool) _feeExempt;
		address _feeCollectionAddress;
		address _minterAddress;
		uint256 feeRate;
		uint256 lastFeeChange;
		uint256 maxFee;
		uint256 feeChangeMinDelay;
		uint256 feePrecision;
	}

	// keccak256(abi.encode(uint256(keccak256("storage.ERC20WithFeesStorage")) - 1)) & ~bytes32(uint256(0xff))
	bytes32 private constant ERC20StorageLocation = 0x84f93370f668d60ff19344e905d5e5ea70bb94f6b70992c58975d1579ea05400;

	function _getERC20WithFeesStorage() private pure returns (ERC20WithFeesStorage storage $) {
		assembly {
			$.slot := ERC20StorageLocation
		}
	}

	/**
	 * @dev Initializes the contract setting the deployer as the initial owner.
	 * All two of these values are immutable: they can only be set once during
	 * construction.
	 */
	function __ERC20WithFees_init(
		address initialOwner,
		string memory name_,
		string memory symbol_,
		uint256 feeRate_,
		uint256 maxFee_,
		uint256 delayFeeChange_,
		address feeCollectionAddress_,
		address minter_
	) internal onlyInitializing {
		__ERC20WithFees_init_unchained(
			initialOwner,
			name_,
			symbol_,
			feeRate_,
			maxFee_,
			delayFeeChange_,
			feeCollectionAddress_,
			minter_
		);
	}

	function __ERC20WithFees_init_unchained(
		address initialOwner,
		string memory name_,
		string memory symbol_,
		uint256 feeRate_,
		uint256 maxFee_,
		uint256 delayFeeChange_,
		address feeCollectionAddress_,
		address minter_
	) internal onlyInitializing {
		__ERC20_init(name_, symbol_);
		__Ownable_init(initialOwner);

		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		if (maxFee_ > 10 ** decimals()) {
			revert ERC20WithFeeFeeExceedsMaxFee(10 ** decimals());
		}
		if (feeRate_ > maxFee_) {
			revert ERC20WithFeeFeeExceedsMaxFee(maxFee_);
		}
		if (feeCollectionAddress_ == address(0)) {
			revert ERC20WithFeeInvalidFeeCollector(feeCollectionAddress_);
		}

		if (minter_ == address(0)) {
			revert ERC20WithFeeInvalidMinter(minter_);
		}

		$.feeRate = feeRate_;
		$.lastFeeChange = block.timestamp;
		$.feePrecision = 365 days * 10 ** decimals();
		$.maxFee = maxFee_;
		$.feeChangeMinDelay = delayFeeChange_;
		$._feeCollectionAddress = feeCollectionAddress_;
		$._minterAddress = minter_;

		setFeeExempt(feeCollectionAddress_);
		setFeeExempt(minter_);
	}

	/**
	 * @notice shows the amount of tokens that are available to be transferred, after fees are deducted
	 */
	function balanceOf(address account) public view override returns (uint256) {
		uint256 balance = super.balanceOf(account);

		uint256 fee = _calculateFee(account);
		return balance - fee;
	}

	/**
	 * @notice See {IERC20-balanceOf}.
	 */
	function balanceOfWithFee(address account) public view returns (uint256) {
		return super.balanceOf(account);
	}

	/**
	 * @dev Atomically increases the allowance granted to `spender` by the caller.
	 *
	 * This is an alternative to {approve} that can be used as a mitigation for
	 * problems described in {IERC20-approve}.
	 *
	 * Emits an {Approval} event indicating the updated allowance.
	 *
	 * Requirements:
	 *
	 * - `spender` cannot be the zero address.
	 */
	function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
		address sender = _msgSender();
		_approve(sender, spender, allowance(sender, spender) + addedValue);
		return true;
	}

	/**
	 * @dev Atomically decreases the allowance granted to `spender` by the caller.
	 *
	 * This is an alternative to {approve} that can be used as a mitigation for
	 * problems described in {IERC20-approve}.
	 *
	 * Emits an {Approval} event indicating the updated allowance.
	 *
	 * Requirements:
	 *
	 * - `spender` cannot be the zero address.
	 * - `spender` must have allowance for the caller of at least
	 * `subtractedValue`.
	 */
	function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
		address sender = _msgSender();
		uint256 currentAllowance = allowance(sender, spender);
		if (currentAllowance < subtractedValue) {
			revert ERC20WithFeesDecreasedAllowanceBelowZero();
		}
		unchecked {
			_approve(sender, spender, currentAllowance - subtractedValue);
		}

		return true;
	}

	function _update(address from, address to, uint256 value) internal virtual override {
		if (from != address(0)) {
			_payFee(from);
		}
		if (to != address(0)) {
			_payFee(to);
		}
		super._update(from, to, value);
	}

	/**
	 * @notice mints new tokens into circulation, meaning that more real-world
	 * assets are now represented by the token
	 * @dev only the minter can mint new tokens
	 */
	function mint(uint256 amount) public onlyMinter {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		if ($.oracle != address(0)) {
			uint256 reserve = IProofOfReserveOracle($.oracle).lockedValue();
			if (reserve < amount + super.totalSupply()) {
				revert ERC20WithFeeMintingLimitReached(reserve);
			}
		}
		super._mint($._minterAddress, amount);
	}

	/**
	 * @dev Utility function to transfer all tokens from the owner to another, taking into account the owed fees so the
	 * balance of the owner will be 0 after the transfer.
	 *
	 */
	function transferAll(address to) public virtual returns (bool) {
		address sender = _msgSender();
		uint256 amount = balanceOf(sender);
		_transfer(sender, to, amount);
		return true;
	}

	/**
	 * @dev Destroys a `value` amount of tokens from the caller.
	 *
	 * See {ERC20-_burn}.
	 */
	function burnFrom(address account, uint256 value) public onlyMinter {
		_spendAllowance(account, _msgSender(), value);
		_burn(account, value);
	}

	/**
	 * @notice returns the last time the fee was deducted for the given account
	 * @dev returns 0 if the account has never had a fee deducted -> never held tokens
	 */
	function feeLastPaid(address account) public view virtual returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		return $._feeLastPaid[account];
	}

	/**
	 * @notice returns the fees to be deducted for the given account, outstanding fees before a fee change in the contract is not included
	 * @dev returns 0 if the account has never held tokens or is currently exempt
	 * for the period between the last fee deduction for the account and the last fee change in the contract is not included in fee calculation
	 */
	function _calculateFee(address account) internal view returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		uint256 balance = super.balanceOf(account);

		if (balance == 0 || $._feeExempt[account]) {
			return 0;
		}
		uint256 lastPaid = $._feeLastPaid[account] > $.lastFeeChange ? $._feeLastPaid[account] : $.lastFeeChange;

		uint256 elapsed = block.timestamp - lastPaid;

		uint256 fee = Math.mulDiv(elapsed * $.feeRate, balance, $.feePrecision);

		if (fee > balance) {
			fee = balance;
		}

		return fee;
	}

	function _payFee(address account) internal returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		uint256 fee = _calculateFee(account);
		if (fee > 0) {
			super._update(account, $._feeCollectionAddress, fee);
		}
		$._feeLastPaid[account] = block.timestamp;

		return fee;
	}

	function setFeeRate(uint256 newFee_) public onlyOwner {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		if (newFee_ > $.maxFee) {
			revert ERC20WithFeeFeeExceedsMaxFee($.maxFee);
		}
		if (block.timestamp - $.lastFeeChange <= $.feeChangeMinDelay) {
			revert ERC20WithFeeFeeChangeTooSoon($.feeChangeMinDelay);
		}

		$.lastFeeChange = block.timestamp;
		$.feeRate = newFee_;

		emit FeeChanged($.feeRate);
	}

	function collectFees(address[] calldata accounts) public {
		for (uint256 i = 0; i < accounts.length; i++) {
			_payFee(accounts[i]);
		}
	}

	/**
	 * @dev Set this account as being exempt from storage fees. This may be used
	 * in special circumstance for cold storage addresses owed by Cache, exchanges, etc.
	 * @param account The account to exempt from storage fees
	 */
	function setFeeExempt(address account) public onlyOwner {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		$._feeExempt[account] = true;
	}

	/**
	 * @dev Set account is no longer exempt from all fees
	 * @param account The account to reactivate fees
	 */
	function unsetFeeExempt(address account) public onlyOwner {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		$._feeExempt[account] = false;
		$._feeLastPaid[account] = block.timestamp;
	}

	/**
	 * @dev Public view function to verify if an account is exempt from fees
	 * @param account The account to check
	 */
	function feeExempt(address account) public view returns (bool) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		return $._feeExempt[account];
	}

	/**
	 * @dev Set the address that will receive all fees collected
	 * @param newAddress The address to receive fees
	 */

	function setFeeCollectionAddress(address newAddress) public onlyOwner {
		if (newAddress == address(0)) {
			revert ERC20WithFeeInvalidFeeCollector(newAddress);
		}
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		unsetFeeExempt($._feeCollectionAddress);
		$._feeCollectionAddress = newAddress;
		setFeeExempt(newAddress);
	}

	/**
	 * @dev Set the address that will mint new tokens
	 * @param newAddress The address to mint tokens
	 */
	function setMinterRole(address newAddress) public onlyOwner {
		if (newAddress == address(0)) {
			revert ERC20WithFeeInvalidMinter(newAddress);
		}

		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		unsetFeeExempt($._minterAddress);
		$._minterAddress = newAddress;
		setFeeExempt(newAddress);
	}

	/**
	 * @dev Set the LockedGoldOracle address
	 * @param newAddress The new address for oracle
	 * @return An bool representing successfully changing oracle address
	 */
	function setOracleAddress(address newAddress) external onlyOwner returns (bool) {
		if (newAddress == address(0)) {
			revert ERC20WithFeeInvalidOracle(newAddress);
		}
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		$.oracle = newAddress;
		emit OracleAddressChanged(newAddress);
		return true;
	}

	function decimals() public view virtual override returns (uint8) {
		return 8;
	}

	function feeRate() public view returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $.feeRate;
	}

	function maxFee() public view returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $.maxFee;
	}

	function lastFeeChange() public view returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $.lastFeeChange;
	}

	function feeChangeMinDelay() public view returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $.feeChangeMinDelay;
	}

	function oracle() public view returns (address) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $.oracle;
	}

	/*
	 * @dev Throws if called by any account other than the MINTER.
	 */
	modifier onlyMinter() {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		address sender = _msgSender();
		if (sender != $._minterAddress) {
			revert NotMinter(sender);
		}
		_;
	}
}
