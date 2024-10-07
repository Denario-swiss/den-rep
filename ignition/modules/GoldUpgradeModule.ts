import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { GoldProxyModule } from "./GoldProxyModule"
import { GoldModule } from "./GoldModule"

const GoldUpgradeModule = buildModule("GoldUpgradeModule", (builder) => {
	const { instance, proxy } = builder.useModule(GoldModule)

	const newImplementation = builder.contract("DenarioGoldV2")

	builder.call(instance, "upgradeToAndCall", [newImplementation, "0x"], {
		from: builder.getAccount(0),
	})

	return { proxy }
})
