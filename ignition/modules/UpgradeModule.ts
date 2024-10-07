import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { ProxyModule } from "./ProxyModule"
import { TokenModule } from "./TokenModule"

const UpgradeModule = buildModule("UpgradeModule", (builder) => {
	// const { instance, proxy } = builder.useModule(TokenModule)

	// builder.call(instance, "upgradeToAndCall", [newImplementation, "0x"], {
	// 	from: builder.getAccount(0),
	// })

	// return { proxy }

	const newImplementation = builder.contract("DSCV2")

	return { newImplementation }
})

export default UpgradeModule
