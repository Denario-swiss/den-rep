import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { ProxyModule } from "./ProxyModule"
import { TokenModule } from "./TokenModule"

const UpgradeModule = buildModule("UpgradeModule", (builder) => {
	const { instance, proxy } = builder.useModule(TokenModule)

	const newImplementation = builder.contract("DSCV2")

	builder.call(instance, "upgradeToAndCall", [newImplementation, "0x"])

	return { proxy }
})

export default UpgradeModule
