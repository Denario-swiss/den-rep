// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { IERC20Metadata } from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import { ContextUpgradeable } from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import { Ownable2StepUpgradeable } from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import { Math } from '@openzeppelin/contracts/utils/math/Math.sol';

import './IProofOfReserveOracle.sol';

abstract contract ERC20WithFeesUpgradeable is
	ContextUpgradeable,
	IERC20,
	IERC20Metadata,
	Ownable2StepUpgradeable
{
	event FeeChanged(uint256 newFee);
	event OracleAddressChanged(address oracle);

	/// @custom:storage-location erc7201:storage.ERC20WithFeesStorage
	struct ERC20WithFeesStorage {
		mapping(address account => uint256) _balances;
		mapping(address account => mapping(address spender => uint256)) _allowances;
		uint256 _totalSupply;
		string _name;
		string _symbol;
		uint8 _decimals;
		address oracle;
		mapping(address => uint256) _feeLastPaid;
		mapping(address => bool) _feeExempt;
		address _feeCollectionAddress;
		address _minterAddress;
		uint256 feeRate;
		uint256 maxFeeDuration;
		uint256 lastFeeChange;
		uint256 maxFee;
		uint256 feeChangeMinDelay;
		uint256 feePrecision;
	}

	// keccak256(abi.encode(uint256(keccak256("storage.ERC20WithFeesStorage")) - 1)) & ~bytes32(uint256(0xff))
	bytes32 private constant ERC20StorageLocation =
		0x84f93370f668d60ff19344e905d5e5ea70bb94f6b70992c58975d1579ea05400;

	function _getERC20WithFeesStorage()
		private
		pure
		returns (ERC20WithFeesStorage storage $)
	{
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
		uint8 decimals_,
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
			decimals_,
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
		uint8 decimals_,
		uint256 feeRate_,
		uint256 maxFee_,
		uint256 delayFeeChange_,
		address feeCollectionAddress_,
		address minter_
	) internal onlyInitializing {
		__Ownable_init(initialOwner);

		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		require(maxFee_ <= 10 ** decimals_, 'ERC20WithFees: max fee too high');
		require(
			feeRate_ <= maxFee_,
			'ERC20WithFees: fee cannot be more than max fee'
		);
		require(
			feeCollectionAddress_ != address(0),
			'ERC20WithFees: fee collection address cannot be the zero address'
		);
		require(
			minter_ != address(0),
			'ERC20WithFees: minter address cannot be the zero address'
		);

		$._name = name_;
		$._symbol = symbol_;
		$._decimals = decimals_;

		$.feeRate = feeRate_;
		$.maxFeeDuration = Math.mulDiv(10 ** decimals_, 365 days, feeRate_);

		$.lastFeeChange = block.timestamp;
		$.feePrecision = 365 days * 10 ** decimals_;
		$.maxFee = maxFee_;
		$.feeChangeMinDelay = delayFeeChange_;
		$._feeCollectionAddress = feeCollectionAddress_;
		$._minterAddress = minter_;

		setFeeExempt(feeCollectionAddress_);
		setFeeExempt(minter_);
	}

	// IERC20 implementation

	/**
	 * @dev See {IERC20-totalSupply}.
	 */
	function totalSupply() public view override returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $._totalSupply;
	}

	/**
	 * @notice shows the amount of tokens that are available to be transferred, after fees are deducted
	 */
	function balanceOf(address account) public view override returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		uint256 fee = _calculateFee(account);
		if ($._balances[account] < fee) {
			return 0;
		}
		return $._balances[account] - fee;
	}

	/**
	 * @notice See {IERC20-balanceOf}.
	 */
	function balanceOfWithFee(address account) public view returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		return $._balances[account];
	}

	/**
	 * @dev See {IERC20-transfer}.
	 *
	 * Requirements:
	 *
	 * - `to` cannot be the zero address.
	 * - the caller must have a balance of at least `amount`.
	 */
	function transfer(
		address to,
		uint256 amount
	) public virtual override returns (bool) {
		address sender = _msgSender();
		_transfer(sender, to, amount);
		return true;
	}

	/**
	 * @dev See {IERC20-allowance}.
	 */
	function allowance(
		address owner,
		address spender
	) public view virtual override returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		return $._allowances[owner][spender];
	}

	/**
	 * @dev See {IERC20-approve}.
	 *
	 * NOTE: If `amount` is the maximum `uint256`, the allowance is not updated on
	 * `transferFrom`. This is semantically equivalent to an infinite approval.
	 *
	 * Requirements:
	 *
	 * - `spender` cannot be the zero address.
	 */
	function approve(
		address spender,
		uint256 amount
	) public virtual override returns (bool) {
		address sender = _msgSender();
		_approve(sender, spender, amount);
		return true;
	}

	/**
	 * @dev See {IERC20-transferFrom}.
	 *
	 * Emits an {Approval} event indicating the updated allowance. This is not
	 * required by the EIP. See the note at the beginning of {ERC20}.
	 *
	 * NOTE: Does not update the allowance if the current allowance
	 * is the maximum `uint256`.
	 *
	 * Requirements:
	 *
	 * - `from` and `to` cannot be the zero address.
	 * - `from` must have a balance of at least `amount`.
	 * - the caller must have allowance for ``from``'s tokens of at least
	 * `amount`.
	 */
	function transferFrom(
		address from,
		address to,
		uint256 amount
	) public virtual override returns (bool) {
		address spender = _msgSender();
		_spendAllowance(from, spender, amount);
		_transfer(from, to, amount);
		return true;
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
	function increaseAllowance(
		address spender,
		uint256 addedValue
	) public virtual returns (bool) {
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
	function decreaseAllowance(
		address spender,
		uint256 subtractedValue
	) public virtual returns (bool) {
		address sender = _msgSender();
		uint256 currentAllowance = allowance(sender, spender);
		require(
			currentAllowance >= subtractedValue,
			'ERC20: decreased allowance below zero'
		);
		unchecked {
			_approve(sender, spender, currentAllowance - subtractedValue);
		}

		return true;
	}

	/**
	 * @dev Moves `amount` of tokens from `sender` to `recipient`.
	 *
	 * This internal function is equivalent to {transfer}, and can be used to
	 * e.g. implement automatic token fees, slashing mechanisms, etc.
	 *
	 * Emits a {Transfer} event.
	 *
	 * Requirements:
	 *
	 * - `from` cannot be the zero address.
	 * - `to` cannot be the zero address.
	 * - `from` must have a balance of at least `amount`.
	 */
	function _transfer(
		address from,
		address to,
		uint256 amount
	) internal virtual {
		require(from != address(0), 'ERC20: transfer from the zero address');
		require(to != address(0), 'ERC20: transfer to the zero address');
		require(amount > 0, 'ERC20: transfer amount must be greater than 0');
		require(from != to, 'ERC20: self transfer is not allowed');

		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		_payFee(from);
		require(
			$._balances[from] >= amount,
			'ERC20: transfer amount exceeds balance'
		);
		$._balances[from] = $._balances[from] - amount;

		_payFee(to);
		$._balances[to] += amount;

		emit Transfer(from, to, amount);
	}

	/** @dev Creates `amount` tokens and assigns them to `account`, increasing
	 * the total supply.
	 *
	 * Emits a {Transfer} event with `from` set to the zero address.
	 *
	 * Requirements:
	 *
	 * - `account` cannot be the zero address.
	 */
	function _mint(address account, uint256 amount) internal virtual {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		$._totalSupply += amount;
		$._balances[account] += amount;

		emit Transfer(address(0), account, amount);
	}

	/**
	 * @dev Destroys `amount` tokens from `account`, reducing the
	 * total supply.
	 *
	 * Emits a {Transfer} event with `to` set to the zero address.
	 *
	 * Requirements:
	 *
	 * - `account` cannot be the zero address.
	 * - `account` must have at least `amount` tokens.
	 */
	function _burn(address account, uint256 amount) internal virtual {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		uint256 accountBalance = $._balances[account];
		require(accountBalance >= amount, 'ERC20: burn amount exceeds balance');
		unchecked {
			$._balances[account] = accountBalance - amount;
		}
		$._totalSupply -= amount;

		emit Transfer(account, address(0), amount);
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
			require(
				reserve >= amount + $._totalSupply,
				'ERC20WithFees: new total supply amount would exceed reserve balance'
			);
		}
		_mint($._minterAddress, amount);
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
	 * @notice burns tokens, meaning that less real-world assets are now
	 * represented by the token
	 * @dev only the minter can burn tokens, with the approval of the owner
	 * this is used in the process of redeeming tokens for real-world assets
	 * if the owner has not enough balance to burn + pay fees, the fee will be paid from the burn amount
	 * @param account the account to burn tokens from
	 * @param amount the amount of tokens to burn
	 */
	function burn(
		address account,
		uint256 amount
	) public onlyMinter returns (uint256) {
		require(
			account != address(0),
			"ERC20: can't burn from the zero address"
		);

		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		address sender = _msgSender();
		if (sender != account) {
			_spendAllowance(account, sender, amount);
		}
		uint256 paid = _payFee(account);

		if (paid > 0 && $._balances[account] < amount) {
			amount = $._balances[account];
		}

		_burn(account, amount);
		return amount;
	}

	/**
	 * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
	 *
	 * This internal function is equivalent to `approve`, and can be used to
	 * e.g. set automatic allowances for certain subsystems, etc.
	 *
	 * Emits an {Approval} event.
	 *
	 * Requirements:
	 *
	 * - `owner` cannot be the zero address.
	 * - `spender` cannot be the zero address.
	 */
	function _approve(
		address owner,
		address spender,
		uint256 amount
	) internal virtual {
		require(owner != address(0), 'ERC20: approve from the zero address');
		require(spender != address(0), 'ERC20: approve to the zero address');

		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		$._allowances[owner][spender] = amount;
		emit Approval(owner, spender, amount);
	}

	/**
	 * @dev Updates `owner` s allowance for `spender` based on spent `amount`.
	 *
	 * Does not update the allowance amount in case of infinite allowance.
	 * Revert if not enough allowance is available.
	 *
	 * Might emit an {Approval} event.
	 */
	function _spendAllowance(
		address owner,
		address spender,
		uint256 amount
	) internal virtual {
		uint256 currentAllowance = allowance(owner, spender);
		if (currentAllowance != type(uint256).max) {
			require(
				currentAllowance >= amount,
				'ERC20: insufficient allowance'
			);
			unchecked {
				_approve(owner, spender, currentAllowance - amount);
			}
		}
	}

	// Token specific funtions to calculate and collect fees

	/**
	 * @notice returns the last time the fee was deducted for the given account
	 * @dev returns 0 if the account has never had a fee deducted -> never held tokens
	 */
	function feeLastPaid(
		address account
	) public view virtual returns (uint256) {
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

		if ($._balances[account] == 0 || $._feeExempt[account]) {
			return 0;
		}
		uint256 lastPaid = $._feeLastPaid[account] > $.lastFeeChange
			? $._feeLastPaid[account]
			: $.lastFeeChange;

		uint256 elapsed = block.timestamp - lastPaid;

		if (elapsed >= $.maxFeeDuration) {
			return $._balances[account];
		}

		return
			Math.mulDiv(
				elapsed * $.feeRate,
				$._balances[account],
				$.feePrecision
			);
	}

	function _payFee(address account) internal returns (uint256) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		uint256 fee = _calculateFee(account);
		if (fee > 0) {
			$._balances[account] -= fee;
			$._balances[$._feeCollectionAddress] += fee;
			emit Transfer(account, $._feeCollectionAddress, fee);
		}
		$._feeLastPaid[account] = block.timestamp;

		return fee;
	}

	function setFeeRate(uint256 newFee_) public onlyOwner {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		require(
			newFee_ <= $.maxFee,
			'ERC20WithFees: fee cannot be more than max fee'
		);
		require(
			block.timestamp - $.lastFeeChange > $.feeChangeMinDelay,
			'ERC20WithFees: fee change delay not passed'
		);

		$.lastFeeChange = block.timestamp;
		$.feeRate = newFee_;
		$.maxFeeDuration = Math.mulDiv(10 ** $._decimals, 365 days, $.feeRate);

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
		require(
			newAddress != address(0),
			'ERC20WithFees: collection address cannot be zero'
		);
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
		require(
			newAddress != address(0),
			'ERC20WithFees: collection address cannot be zero'
		);
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		unsetFeeExempt($._minterAddress);
		$._minterAddress = newAddress;
		setFeeExempt(newAddress);
	}

	/**
	 * @dev Set the LockedGoldOracle address
	 * @param oracleAddress The address for oracle
	 * @return An bool representing successfully changing oracle address
	 */
	function setOracleAddress(
		address oracleAddress
	) external onlyOwner returns (bool) {
		require(
			oracleAddress != address(0),
			'ERC20WithFees: oracle address cannot be zero'
		);
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();

		$.oracle = oracleAddress;
		emit OracleAddressChanged(oracleAddress);
		return true;
	}

	function decimals() public view virtual override returns (uint8) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $._decimals;
	}

	function name() public view virtual override returns (string memory) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $._name;
	}

	function symbol() public view virtual override returns (string memory) {
		ERC20WithFeesStorage storage $ = _getERC20WithFeesStorage();
		return $._symbol;
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

		require(
			msg.sender == $._minterAddress,
			'ERC20WithFees: only minter can call this function'
		);
		_;
	}
}
