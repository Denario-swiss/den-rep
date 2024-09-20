import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { ProxyModule } from "./ProxyModule"
import { TokenModule } from "./TokenModule"

const UpgradeModule = buildModule("UpgradeModule", (builder) => {
	const { instance, proxy } = builder.useModule(TokenModule)

	const newImplementation = builder.contract("DS")

	builder.call(instance, "upgradeToAndCall", [newImplementation, "0x"], {
		from: builder.getAccount(0),
	})

	return { proxy }
})

export default UpgradeModule
