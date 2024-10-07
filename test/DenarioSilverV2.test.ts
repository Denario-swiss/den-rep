import {
	loadFixture,
	time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { ethers, ignition } from "hardhat"
import TokenModule from "../ignition/modules/TokenModule"
import OracleModule from "../ignition/modules/OracleModule"
import {
	Proxy,
	DSCV2,
	DSCV2__factory,
	MockOracle,
	MockOracle__factory,
	ERC20WithFeesUpgradeable,
	ERC20WithFeesUpgradeable__factory,
} from "../typechain-types"
import { ZeroAddress } from "ethers"
import {
	setupUser,
	fundFromDeployer,
	timeJumpForward,
	getRandomInt,
} from "./utils"

const SUPPLY = ethers.parseUnits("1000000", 8)
const MONTH = 30 * 24 * 60 * 60
const YEAR = 365 * 24 * 60 * 60

const setup = async () => {
	const [deployer, owner, minter, treasury, ...users] =
		await ethers.getSigners()

	const name = "Denario Test Coin 2"
	const symbol = "DTC2"
	const feeRate = BigInt(2500000)
	const maxFeeRate = BigInt(5000000)
	const delayFeeChange = (365 * 24 * 60 * 60) / 2

	const { instance, proxy } = await ignition.deploy(TokenModule, {
		parameters: {
			ProxyModule: {
				name: name,
				symbol: symbol,
				minterAddress: minter.address,
				feeCollectionAddress: treasury.address,
				ownerAddress: owner.address,
				fee: feeRate,
				maxFeeRate: maxFeeRate,
				delayFeeChange: delayFeeChange,
			},
		},
		defaultSender: deployer.address,
	})

	const { oracle } = await ignition.deploy(OracleModule, {
		parameters: {
			OracleModule: {},
		},
	})

	const dscV2: DSCV2 = DSCV2__factory.connect(await proxy.getAddress(), owner)

	// const feeRate = await dscV2.feeRate()

	const decimals = await dscV2.decimals()
	const feeprecision = BigInt(365 * 24 * 60 * 60 * 10 ** Number(decimals))

	await dscV2.connect(minter).mint(SUPPLY)

	const oracleInstance: MockOracle = MockOracle__factory.connect(
		await oracle.getAddress(),
		owner,
	)

	return {
		DSCV2: dscV2.connect(owner),
		Oracle: oracleInstance,
		instance: instance,
		proxy: proxy,
		name: name,
		symbol: symbol,
		feeRate: feeRate,
		maxFeeRate: maxFeeRate,
		delayFeeChange: delayFeeChange,
		decimals: decimals,
		feeCollector: treasury,
		feePrecision: feeprecision,
		owner: owner,
		minter: minter,
		users: users,
		deployer: deployer,
	}
}

describe("Denario Silver Coin (DSC) Version 2", () => {
	describe("Deployment", () => {
		it("initialise only once", async () => {
			const { instance } = await setup()
			await expect(instance.initialize()).to.be.reverted
		})

		it("shown correct deployment data", async () => {
			const {
				instance,
				name,
				symbol,
				decimals,
				feeRate,
				maxFeeRate,
				delayFeeChange,
			} = await setup()

			const actualName = await instance.name()
			const actualSymbol = await instance.symbol()
			const actualDecimals = await instance.decimals()
			const actualSupply = await instance.totalSupply()

			expect(name).to.equal(actualName)
			expect(symbol).to.equal(actualSymbol)
			expect(decimals).to.equal(actualDecimals)
			expect(SUPPLY).to.equal(actualSupply)

			const actualFeeRate = await instance.feeRate()
			const actualMaxFeeRate = await instance.maxFee()
			const actualDelayFeeChange = await instance.feeChangeMinDelay()

			expect(feeRate).to.equal(actualFeeRate)
			expect(maxFeeRate).to.equal(actualMaxFeeRate)
			expect(delayFeeChange).to.equal(actualDelayFeeChange)
		})

		it("initial owner is correct", async () => {
			const { DSCV2, owner } = await setup()
			let actualOwner = await DSCV2.owner()
			expect(actualOwner).to.equal(owner.address)
		})
	})

	describe("Set new fee rate", () => {
		it("Only owner", async () => {
			const { DSCV2, users } = await setup()

			let user = users[0]

			await expect(
				DSCV2.connect(user).setFeeRate(ethers.parseUnits("1", 8)),
			).to.be.reverted
		})

		it("Set lower fee rate", async () => {
			const { DSCV2 } = await setup()
			const currentFee = await DSCV2.feeRate()

			expect(await DSCV2.reduceFeeRate(0)).to.not.be.reverted

			const newFee = await DSCV2.feeRate()
			expect(newFee).to.equal(0)
		})
	})

	describe("Test Upgrade", () => {
		var DSCV2Address: string
		beforeEach(async () => {
			const {} = await setup()

			// Deploy new implementation
			const NewDSC = await ethers.getContractFactory("DSCV2")
			const newDSC = await NewDSC.deploy()
			await newDSC.waitForDeployment()

			DSCV2Address = await newDSC.getAddress()
		})

		it("Upgrade only by owner", async () => {
			const { DSCV2, users } = await setup()

			const user = users[0]

			await expect(
				DSCV2.connect(user).upgradeToAndCall(user.address, "0x"),
			).to.be.reverted
		})
		it("Upgrade to new contract", async () => {
			const { DSCV2, owner } = await setup()

			let contractOwner = await DSCV2.owner()
			expect(owner).to.be.eq(contractOwner)

			await DSCV2.upgradeToAndCall(DSCV2Address, "0x")
		})
		it("Upgraded version is returned", async () => {
			const { DSCV2, owner } = await setup()
			await DSCV2.connect(owner).upgradeToAndCall(DSCV2Address, "0x")
			expect(await DSCV2.version()).to.equal(2)
		})
		// it("Ledger and state is preserved", async () => {
		// 	const { DSCV2, owner, minter, users, decimals, feePrecision } =
		// 		await setup()

		// 	const user = users[0]
		// 	const user2 = users[1]
		// 	const amount = ethers.parseUnits("100", decimals)
		// 	const approveAmount = ethers.parseUnits("50", decimals)

		// 	await fundFromDeployer(DSCV2, minter, user.address, amount)
		// 	const fundTs = await time.latest()

		// 	await DSCV2.connect(user).approve(user2.address, approveAmount)

		// 	const feeLastPaidBefore = await DSCV2.feeLastPaid(user.address)
		// 	const feeRateBefore = await DSCV2.feeRate()
		// 	const maxFeeBefore = await DSCV2.maxFee()
		// 	const totalSupplyBefore = await DSCV2.totalSupply()
		// 	const lastFeeChangeBefore = await DSCV2.lastFeeChange()
		// 	const feeChangeMinDelayBefore = await DSCV2.feeChangeMinDelay()
		// 	const oracleBefore = await DSCV2.oracle()
		// 	const balanceWithFeeBefore = await DSCV2.balanceOfWithFee(
		// 		user.address,
		// 	)
		// 	const allowanceBefore = await DSCV2.allowance(
		// 		user.address,
		// 		user2.address,
		// 	)

		// 	await DSCV2.connect(owner).upgradeToAndCall(DSCV2Address, "0x")

		// 	// Check if the state is preserved
		// 	const feeLastPaidAfter = await DSCV2.feeLastPaid(user.address)
		// 	const feeRateAfter = await DSCV2.feeRate()
		// 	const maxFeeAfter = await DSCV2.maxFee()
		// 	const totalSupplyAfter = await DSCV2.totalSupply()
		// 	const lastFeeChangeAfter = await DSCV2.lastFeeChange()
		// 	const feeChangeMinDelayAfter = await DSCV2.feeChangeMinDelay()
		// 	const oracleAfter = await DSCV2.oracle()
		// 	const balanceWithFeeAfter = await DSCV2.balanceOfWithFee(user.address)
		// 	const allowanceAfter = await DSCV2.allowance(
		// 		user.address,
		// 		user2.address,
		// 	)

		// 	expect(feeLastPaidBefore).to.equal(feeLastPaidAfter)
		// 	expect(feeRateBefore).to.equal(feeRateAfter)
		// 	expect(maxFeeBefore).to.equal(maxFeeAfter)
		// 	expect(totalSupplyBefore).to.equal(totalSupplyAfter)
		// 	expect(lastFeeChangeBefore).to.equal(lastFeeChangeAfter)
		// 	expect(feeChangeMinDelayBefore).to.equal(feeChangeMinDelayAfter)
		// 	expect(oracleBefore).to.equal(oracleAfter)
		// 	expect(balanceWithFeeBefore).to.equal(balanceWithFeeAfter)
		// 	expect(allowanceBefore).to.equal(allowanceAfter)

		// 	// Check if the ledger is preserved
		// 	const fundTsAfter = await time.latest()
		// 	let elapsed = fundTsAfter - fundTs

		// 	let expectedFee =
		// 		(BigInt(feeRateAfter) * BigInt(elapsed) * BigInt(amount)) /
		// 		feePrecision
		// 	let expectedBalance = amount - expectedFee
		// 	const balanceAfter = await DSCV2.balanceOf(user.address)

		// 	expect(balanceAfter).to.equal(expectedBalance)

		// 	// transferFrom
		// 	await DSCV2.connect(user2).transferFrom(
		// 		user.address,
		// 		user2.address,
		// 		approveAmount,
		// 	)
		// 	const balanceAfter2 = await DSCV2.balanceOf(user2.address)
		// 	expect(balanceAfter2).to.equal(approveAmount)
		// })
	})
})
