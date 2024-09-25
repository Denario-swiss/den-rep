import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { ProxyModule } from "./ProxyModule"

export const TokenModule = buildModule("TokenModule", (builder) => {
	// Get the proxy from the previous module.
	const { proxy } = builder.useModule(ProxyModule)

	// Create a contract instance using the deployed proxy's address.
	const instance = builder.contractAt("DSC", proxy)

	return { instance, proxy }
})

export default TokenModule
