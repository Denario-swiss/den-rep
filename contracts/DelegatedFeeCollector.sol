// SPDX-License-Identifier: MIT

pragma solidity ^0.8.1;

// Inheritance
import "./Owned.sol";

abstract contract DelegatedFeeCollector is Owned {
    address _feeCollector;

    function feeCollector() external view returns (address) {
        return _feeCollector;
    }

    constructor(address _owner, address feeCollector_) Owned(_owner) {
        _feeCollector = feeCollector_;
    }

    modifier onlyFeeCollector() {
        require(
            msg.sender == _feeCollector,
            "Caller is not DelegatedFeeCollector"
        );
        _;
    }

    function setFeeCollector(address feeCollector_) external onlyOwner {
        _feeCollector = feeCollector_;
    }
}
