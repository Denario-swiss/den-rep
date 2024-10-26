import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { GoldTimelockController } from "./GoldTimelockController"

export const GoldProxyModule = buildModule("GoldProxyModule", (builder) => {
	// Get the proxy from the previous module.
	// const timelockController = builder.useModule(GoldTimelockController)
	const { timelock } = builder.useModule(GoldTimelockController)

	// Deploy the implementation contract
	const implementation = builder.contract("DenarioGold")

	// Fetch environment variables for the implementation contract.
	// replaced by TimelockController address:
	// const _ownerAddress = builder.getParameter("ownerAddress")
	// const _minterAddress = builder.getParameter("minterAddress")
	const _tokenName = builder.getParameter("name")
	const _tokenSymbol = builder.getParameter("symbol")
	const _feeCollectionAddress = builder.getParameter("feeCollectionAddress")
	const _fee = builder.getParameter("fee")
	const _maxFee = builder.getParameter("maxFee")
	// 365 * 24 * 60 * 60, // 31536000 seconds = 1 year
	// (365 * 24 * 60 * 60) / 2, // 15768000 seconds = 6 months
	const _delayFeeUpdate = builder.getParameter("delayFeeUpdate")

	// Create the implementation contract with the provided parameters.
	const args = [
		timelock, //_ownerAddress,
		_tokenName,
		_tokenSymbol,
		_fee,
		_maxFee,
		_delayFeeUpdate,
		_feeCollectionAddress,
		timelock, //_minterAddress,
	]

	// Encode the initialize function call for the contract.
	const initialize = builder.encodeFunctionCall(
		implementation,
		"initialize",
		args,
	)

	// Deploy the ERC1967 Proxy, pointing to the implementation
	const proxy = builder.contract("ERC1967Proxy", [implementation, initialize])

	return { proxy }
})

export default GoldProxyModule
