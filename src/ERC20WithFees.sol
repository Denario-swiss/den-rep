// SPDX-License-Identifier: UNLICENSED
// OpenZeppelin Contracts (last updated v4.6.0)

pragma solidity ^0.8.1;
import "./openzeppelin-contracts/token/ERC20/IERC20.sol";
import "./openzeppelin-contracts/utils/Context.sol";
import "./openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./openzeppelin-contracts/access/Ownable2Step.sol";
import "./openzeppelin-contracts/utils/math/Math.sol";
import "./IProofOfReserveOracle.sol";

import "hardhat/console.sol";

contract ERC20WithFees is Context, IERC20, IERC20Metadata, Ownable2Step {
    event FeeChanged(uint256 newFee);
    event OracleAddressChanged(address oracle);

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string public override name;
    string public override symbol;
    uint8 public immutable override decimals;

    // address of the proof of reserves oracle which provides the real world locked amount
    address public oracle;

    // Last time a fee was paid for an address
    mapping(address => uint256) private _feeLastPaid;

    // Addresses not subject to transfer fees
    mapping(address => bool) private _feeExempt;

    // Address where fees are collected
    address private _feeCollectionAddress;

    // address that can mint and burn tokens
    address private _minterAddress;

    /**
     * @notice amount of tokens automatically collected from each holder as fee
     * representing the off chain costs of managing the off chain assets
     * represented by the token
     * expressed as how many tokens are collected from 1 token for each year
     *
     * @dev fees are sent to the feeCollectionAddress, collection happens at every transfer or by calling the collectFees function
     * _feeExempt addresses are not subject to fees
     */
    uint256 public feeRate;
    uint256 public lastFeeChange;

    uint256 public immutable maxFee;
    uint256 public immutable feeChangeMinDelay;

    uint256 private immutable feePrecision;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 feeRate_,
        uint256 maxFee_,
        uint256 delayFeeChange_,
        address feeCollectionTreasury_,
        address minter_
    ) Ownable2Step() {
        require(
            feeRate_ <= maxFee_,
            "ERC20WithFees: fee rate cannot be greater than 10%"
        );
        require(
            feeCollectionTreasury_ != address(0),
            "ERC20WithFees: fee collection address cannot be the zero address"
        );
        require(
            minter_ != address(0),
            "ERC20WithFees: minter address cannot be the zero address"
        );

        name = name_;
        symbol = symbol_;
        decimals = decimals_;

        feeRate = feeRate_;
        lastFeeChange = block.timestamp;
        feePrecision = 365 days * 10 ** decimals_;
        maxFee = maxFee_;
        feeChangeMinDelay = delayFeeChange_;
        _feeCollectionAddress = feeCollectionTreasury_;
        _minterAddress = minter_;

        setFeeExempt(_feeCollectionAddress);
        setFeeExempt(_minterAddress);
    }

    // IERC20 implementation

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice shows the amount of tokens that are available to be transferred, after fees are deducted
     */
    function balanceOf(address account) public view override returns (uint256) {
        uint256 fee = _calculateFee(account);
        return _balances[account] - fee;
    }

    /**
     * @notice See {IERC20-balanceOf}.
     */
    function balanceOfWithFee(address account) public view returns (uint256) {
        return _balances[account];
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
        return _allowances[owner][spender];
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
            "ERC20: decreased allowance below zero"
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
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(amount > 0, "ERC20: transfer amount must be greater than 0");

        _payFee(from);
        require(
            _balances[from] >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        _balances[from] = _balances[from] - amount;

        _payFee(to);
        _balances[to] += amount;

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
        _totalSupply += amount;
        _balances[account] += amount;

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
        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
        }
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);
    }

    /**
     * @notice mints new tokens into circulation, meaning that more real-world
     * assets are now represented by the token
     * @dev only the minter can mint new tokens
     */
    function mint(uint256 amount) public onlyMinter {
        if (oracle != address(0)) {
            uint256 reserve = IProofOfReserveOracle(oracle).lockedValue();
            require(
                reserve >= amount + _totalSupply,
                "ERC20WithFees: new total supply amount would exceed reserve balance"
            );
        }
        _mint(_minterAddress, amount);
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
        address sender = _msgSender();
        if (sender != account) {
            _spendAllowance(account, sender, amount);
        }
        uint256 paid = _payFee(account);

        if (paid > 0 && _balances[account] < amount) {
            amount = _balances[account];
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
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
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
                "ERC20: insufficient allowance"
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
        return _feeLastPaid[account];
    }

    /**
     * @notice returns the fees to be deducted for the given account, outstanding fees before a fee change in the contract is not included
     * @dev returns 0 if the account has never held tokens or is currently exempt
     * for the period between the last fee deduction for the account and the last fee change in the contract is not included in fee calculation
     */
    function _calculateFee(address account) internal view returns (uint256) {
        if (_balances[account] == 0 || _feeExempt[account]) {
            return 0;
        }
        uint256 lastPaid = _feeLastPaid[account] > lastFeeChange
            ? _feeLastPaid[account]
            : lastFeeChange;

        uint256 elapsed = block.timestamp - lastPaid;
        return Math.mulDiv(elapsed * feeRate, _balances[account], feePrecision);
    }

    function _payFee(address account) internal returns (uint256) {
        uint256 fee = _calculateFee(account);
        if (fee > 0) {
            _balances[account] -= fee;
            _balances[_feeCollectionAddress] += fee;
            emit Transfer(account, _feeCollectionAddress, fee);
        }
        _feeLastPaid[account] = block.timestamp;

        return fee;
    }

    function setFeeRate(uint256 newFee_) public onlyOwner {
        require(
            newFee_ <= maxFee,
            "ERC20WithFees: fee cannot be more than max fee"
        );
        require(
            block.timestamp - lastFeeChange > feeChangeMinDelay,
            "ERC20WithFees: fee change delay not passed"
        );

        lastFeeChange = block.timestamp;
        feeRate = newFee_;

        emit FeeChanged(feeRate);
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
    function setFeeExempt(address account) internal onlyOwner {
        _feeExempt[account] = true;
    }

    /**
     * @dev Set account is no longer exempt from all fees
     * @param account The account to reactivate fees
     */
    function unsetFeeExempt(address account) internal onlyOwner {
        _feeExempt[account] = false;
        _feeLastPaid[account] = block.timestamp;
    }

    /**
     * @dev Set the address that will receive all fees collected
     * @param newAddress The address to receive fees
     */

    function setFeeCollectionAddress(address newAddress) public onlyOwner {
        require(
            newAddress != address(0),
            "ERC20WithFees: collection address cannot be zero"
        );
        unsetFeeExempt(_feeCollectionAddress);
        _feeCollectionAddress = newAddress;
        setFeeExempt(newAddress);
    }

    /**
     * @dev Set the address that will mint new tokens
     * @param newAddress The address to mint tokens
     */
    function setMinterRole(address newAddress) public onlyOwner {
        require(
            newAddress != address(0),
            "ERC20WithFees: collection address cannot be zero"
        );
        unsetFeeExempt(_minterAddress);
        _minterAddress = newAddress;
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
            "ERC20WithFees: oracle address cannot be zero"
        );
        oracle = oracleAddress;
        emit OracleAddressChanged(oracleAddress);
        return true;
    }

    /*
     * @dev Throws if called by any account other than the MINTER.
     */
    modifier onlyMinter() {
        require(
            msg.sender == _minterAddress,
            "ERC20WithFees: only minter can call this function"
        );
        _;
    }
}
