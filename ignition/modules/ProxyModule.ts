import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { ethers } from "hardhat"

const ProxyModule = buildModule("ProxyModule", (builder) => {
	// Deploy the implementation contract
	const implementation = builder.contract("DSC")

	// Fetch environment variables for the implementation contract.
	const _tokenName = process.env.TOKEN_NAME || "Denario Silver Coin"
	const _tokenSymbol = process.env.TOKEN_SYMBOL || "DSC"

	// Use provided addresses or fallback to internal hardhat addresses.
	const account = (a) => builder.getAccount(a)
	const _ownerAddress = process.env.OWNER_ADDRESS || account(0)
	const _minterAddress = process.env.MINTER_ADDRESS || account(0)
	const _feeCollectionAddress = process.env.TREASURY_ADDRESS || account(0)

	// Create the implementation contract with the provided parameters.
	const args = [
		_tokenName,
		_tokenSymbol,
		_feeCollectionAddress,
		_minterAddress,
		_ownerAddress,
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

export const DSCModule = buildModule("DSCModule", (builder) => {
	// Get the proxy from the previous module.
	const { proxy } = builder.useModule(ProxyModule)

	// Create a contract instance using the deployed proxy's address.
	const instance = builder.contractAt("DSC", proxy)

	return { instance, proxy }
})

export default DSCModule
