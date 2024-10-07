import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { GoldProxyModule } from "./GoldProxyModule"

export const GoldModule = buildModule("GoldModule", (builder) => {
	// Get the proxy from the previous module.
	const { proxy } = builder.useModule(GoldProxyModule)

	// Create a contract instance using the deployed proxy's address.
	const instance = builder.contractAt("DenarioGold", proxy)

	return { instance, proxy }
})
