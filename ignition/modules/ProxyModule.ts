import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { ethers } from "hardhat"

const ProxyModule = buildModule("ProxyModule", (builder) => {
	// Deploy the implementation contract
	const implementation = builder.contract("DSC")

	// Fetch environment variables for the implementation contract.
	const _tokenName = process.env.TOKEN_NAME || "Denario Test Coin"
	const _tokenSymbol = process.env.TOKEN_SYMBOL || "DTC"
	const _minterAddress = process.env.MINTER_ADDRESS || "0x80085"
	const _treasuryAddress = process.env.TREASURY_ADDRESS || "0x80085"
	const _ownerAddress = process.env.OWNER_ADDRESS || ""

	// Create the implementation contract with the provided parameters.
	const args = [
		_tokenName,
		_tokenSymbol,
		_minterAddress,
		_treasuryAddress,
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
	const symbol = "DSC"
	const instance = builder.contractAt(symbol, proxy)

	return { instance, proxy }
})

export default DSCModule
