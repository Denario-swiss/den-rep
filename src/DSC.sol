// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "./ERC20WithFeesUpgradeable.sol";

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DSC is ERC20WithFeesUpgradeable, UUPSUpgradeable {
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public initializer {
    __ERC20WithFees_init(
      msg.sender,
      "Denario Silver Coin",
      "DSC",
      8,
      1000000,
      5000000,
      (365 * 24 * 60 * 60) / 2,
      msg.sender,
      msg.sender
    );
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}
}
