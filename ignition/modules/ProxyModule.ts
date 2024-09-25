import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

export const ProxyModule = buildModule("ProxyModule", (builder) => {
	// Deploy the implementation contract
	const implementation = builder.contract("DSC")

	// Fetch environment variables for the implementation contract.

	const _ownerAddress = builder.getParameter("ownerAddress")
	const _tokenName = builder.getParameter("name", "Denario Silver")
	const _tokenSymbol = builder.getParameter("symbol", "DS")
	const _minterAddress = builder.getParameter("minterAddress")
	const _feeCollectionAddress = builder.getParameter("feeCollectionAddress")

	// Create the implementation contract with the provided parameters.
	const args = [
		_ownerAddress,
		_tokenName,
		_tokenSymbol,
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
