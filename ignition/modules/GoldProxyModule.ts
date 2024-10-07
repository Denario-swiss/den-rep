import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

export const GoldProxyModule = buildModule("GoldProxyModule", (builder) => {
	// Deploy the implementation contract
	const implementation = builder.contract("DenarioGold")

	// Fetch environment variables for the implementation contract.

	const _ownerAddress = builder.getParameter("ownerAddress")
	const _tokenName = builder.getParameter("name", "Denario Gold")
	const _tokenSymbol = builder.getParameter("symbol", "DG")
	const _minterAddress = builder.getParameter("minterAddress")
	const _feeCollectionAddress = builder.getParameter("feeCollectionAddress")
	const _fee = builder.getParameter("fee", 1000000)
	const _maxFee = builder.getParameter("maxFee", 5000000)
	const _delayFeeUpdate = builder.getParameter(
		"delayFeeUpdate",
		(365 * 24 * 60 * 60) / 2, // 15768000 seconds = 6 months
	)

	// Create the implementation contract with the provided parameters.
	const args = [
		_ownerAddress,
		_tokenName,
		_tokenSymbol,
		_fee,
		_maxFee,
		_delayFeeUpdate,
		_feeCollectionAddress,
		_minterAddress,
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
