import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

export const GoldTimelockController = buildModule(
	"GoldTimelockController",
	(builder) => {
		const minDelay = builder.getParameter("timelockDuration")
		const proposers = builder.getParameter("proposers")
		const executors = builder.getParameter("executors")

		const args = [minDelay, proposers, executors]
		const timelock = builder.contract("GoldTimelockController", args)

		return { timelock }
	},
)

export default GoldTimelockController
