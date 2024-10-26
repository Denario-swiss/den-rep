import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

export const GoldTimelockController = buildModule(
	"GoldTimelockController",
	(builder) => {
		const minDelay = builder.getParameter("timelockDuration")
		const proposers = builder.getParameter("proposers")
		const executors = builder.getParameter("executors")
		const admin = builder.getParameter("admin")

		const args = [minDelay, proposers, executors, admin]
		const timelock = builder.contract("TimelockController", args)

		return { timelock }
	},
)

export default GoldTimelockController
