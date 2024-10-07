import {
	loadFixture,
	time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { ethers, ignition } from "hardhat"
import { GoldModule } from "../ignition/modules/GoldModule"
import OracleModule from "../ignition/modules/OracleModule"
import {
	Proxy,
	DenarioGold,
	DenarioGold__factory,
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

	const name = "Denario Test Gold Coin"
	const symbol = "DTGC"
	const feeRate = BigInt(2500000)
	const maxFeeRate = BigInt(5000000)
	const delayFeeChange = (365 * 24 * 60 * 60) / 2

	const { instance, proxy } = await ignition.deploy(GoldModule, {
		parameters: {
			GoldProxyModule: {
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

	const denarioGoldCoin: DenarioGold = DenarioGold__factory.connect(
		await proxy.getAddress(),
		owner,
	)

	// const feeRate = await denarioGoldCoin.feeRate()

	const decimals = await denarioGoldCoin.decimals()
	const feeprecision = BigInt(365 * 24 * 60 * 60 * 10 ** Number(decimals))

	await denarioGoldCoin.connect(minter).mint(SUPPLY)

	const oracleInstance: MockOracle = MockOracle__factory.connect(
		await oracle.getAddress(),
		owner,
	)

	return {
		DenarioGold: denarioGoldCoin.connect(owner),
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

describe("Denario Gold Coin (DGC)", () => {
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
			const { DenarioGold, owner } = await setup()
			let actualOwner = await DenarioGold.owner()
			expect(actualOwner).to.equal(owner.address)
		})
	})

	describe("Balance", () => {
		it("shows correct balance", async () => {
			const { DenarioGold, users, minter, decimals, feeRate } =
				await setup()

			const user = users[1]

			const amount = ethers.parseUnits("1", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			let balanceBefore = await DenarioGold.balanceOf(user.address)
			let balanceBeforeWithFees = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			expect(balanceBefore).to.equal(amount)
			expect(balanceBeforeWithFees).to.equal(amount)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(YEAR)

			const balanceAfter = await DenarioGold.balanceOf(user.address)
			const balanceWithFeesAfter = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			let expectedFee =
				(BigInt(amount) * BigInt(feeRate)) /
				BigInt(10 ** Number(decimals))

			expect(balanceAfter).to.equal(balanceBefore - expectedFee)
			expect(balanceWithFeesAfter).to.equal(amount)
		})
		it("shoes correct balance after some time", async () => {
			const {
				DenarioGold,
				minter,
				users,
				decimals,
				feeRate,
				feePrecision,
			} = await setup()

			const user = users[1]

			const amount = ethers.parseUnits("1", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			let balanceBefore = await DenarioGold.balanceOf(user.address)
			let balanceBeforeWithFees = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			expect(balanceBefore).to.equal(amount)
			expect(balanceBeforeWithFees).to.equal(amount)

			expect(balanceBefore).to.equal(amount)
			const beforeTS = await time.latest()

			const randomDays = BigInt(24 * 60 * 60 * getRandomInt(5, 15))
			await timeJumpForward(randomDays)
			const afterTS = await time.latest()

			const balanceAfter = await DenarioGold.balanceOf(user.address)
			const balanceWithFeesAfter = await DenarioGold.balanceOfWithFee(
				user.address,
			)
			let elapsed = afterTS - beforeTS
			let expectedFee =
				(BigInt(feeRate) * BigInt(elapsed) * BigInt(amount)) /
				feePrecision

			expect(balanceAfter).to.equal(balanceBefore - expectedFee)
			expect(balanceWithFeesAfter).to.equal(amount)
		})

		it("shows correct balance: dust", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()
			const user = users[6]

			const amount = ethers.parseUnits("0.00000001", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			await timeJumpForward(101 * 365 * 24 * 60 * 60)

			const balance = await DenarioGold.balanceOf(user.address)
			const balanceWithFees = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			expect(balance).to.equal(0)
			expect(balanceWithFees).to.equal(amount)
		})

		it("reports 0 balance if fee is more than balance", async () => {
			const { DenarioGold, minter, users } = await setup()

			const user = users[0]

			const amount = BigInt(1)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60 * 100 + 1)

			const balance = await DenarioGold.balanceOf(user.address)
			const balanceWithFees = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			expect(balance).to.equal(0)
			expect(balanceWithFees).to.equal(1)
		})
	})

	describe("Transfer", () => {
		it("always possible to transfer all tokens", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DenarioGold, minter, sender.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await DenarioGold.balanceOf.staticCall(
				sender.address,
			)

			await DenarioGold.connect(sender).transferAll(receiver.address)

			let balance = await DenarioGold.balanceOf.staticCall(sender.address)
			let balanceAndFee = await DenarioGold.balanceOfWithFee.staticCall(
				sender.address,
			)
			let fee = balanceAndFee - balance

			expect(balance).to.equal(0)
			expect(fee).to.equal(0)

			let receiverBalance = await DenarioGold.balanceOf.staticCall(
				receiver.address,
			)
			let receiverFee = balanceAndFee - balance

			expect(receiverBalance).to.be.closeTo(balanceBefore, 10)

			expect(receiverFee).to.equal(0)
		})
		it("always possible to transfer all tokens: dust", async () => {
			const { DenarioGold, minter, users } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount: bigint = BigInt(1)
			await fundFromDeployer(DenarioGold, minter, sender.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await DenarioGold.balanceOf.staticCall(
				sender.address,
			)

			await DenarioGold.connect(sender).transferAll(receiver.address)

			let balance = await DenarioGold.balanceOf.staticCall(sender.address)
			let balanceAndFee = await DenarioGold.balanceOfWithFee.staticCall(
				sender.address,
			)
			let fee = balanceAndFee - balance

			expect(balance).to.equal(0)
			expect(fee).to.equal(0)

			let receiverBalance = await DenarioGold.balanceOf.staticCall(
				receiver.address,
			)
			let receiverFee = balanceAndFee - balance

			expect(receiverBalance).to.be.closeTo(balanceBefore, 10)
			expect(receiverFee).to.equal(0)
		})
	})

	describe("Fee last paid", () => {
		it("initialised after receiving tokens", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			let user = users[0]

			const amount = ethers.parseUnits("100", decimals)

			await fundFromDeployer(
				DenarioGold,
				minter,
				user.address,
				amount * BigInt(2),
			)

			const timeStamp = await time.latest()

			let feeLastPaid = await DenarioGold.feeLastPaid(user.address)
			expect(feeLastPaid).to.equal(timeStamp)
		})

		it("receiving tokens updates", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(
				DenarioGold,
				minter,
				sender.address,
				amount * BigInt(2),
			)

			let feeLastPaid = await DenarioGold.feeLastPaid(receiver.address)

			expect(feeLastPaid).to.equal(0)

			await DenarioGold.connect(sender).transfer(receiver.address, amount)

			const timeStamp = await time.latest()
			feeLastPaid = await DenarioGold.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(timeStamp)
		})
	})

	describe("Fee collection", () => {
		it("trigger fee deduction", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()
			const user = users[0]

			await fundFromDeployer(
				DenarioGold,
				minter,
				user.address,
				ethers.parseUnits("1", decimals),
			)

			await timeJumpForward(365 * 24 * 60 * 60)

			await DenarioGold.connect(user).collectFees([user.address])
		})
		it("collects 100% fees", async () => {
			const { DenarioGold, minter, users, decimals, feeRate } =
				await setup()

			let necessaryTime =
				(BigInt(10 ** Number(decimals)) / feeRate) *
					BigInt(365 * 24 * 60 * 60) +
				BigInt(1)

			const user = users[0]
			const amount = ethers.parseUnits("100", decimals)

			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			await timeJumpForward(necessaryTime)

			const balance = await DenarioGold.balanceOf(user.address)
			const balanceWithFee = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			expect(balanceWithFee).to.equal(amount)
			expect(balance).to.equal(0)

			await expect(DenarioGold.connect(user).collectFees([user.address]))

			const balanceAfterCollection = await DenarioGold.balanceOf(
				user.address,
			)
			const balanceWithFeeAdterCollection =
				await DenarioGold.balanceOfWithFee(user.address)

			expect(balanceAfterCollection).to.equal(0)
			expect(balanceWithFeeAdterCollection).to.equal(0)
		})
	})

	describe("Calculate fees", () => {
		it("fees deducted from balance correctly", async () => {
			const { DenarioGold, minter, users, decimals, feeRate } =
				await setup()

			const user = users[0]

			expect(await DenarioGold.balanceOf(user.address)).to.equal(0)
			expect(await DenarioGold.balanceOfWithFee(user.address)).to.equal(0)

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			const balanceBefore = await DenarioGold.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			const t = (365 * 24 * 60 * 60) / 2 // 1/2 year
			await timeJumpForward(t)

			const balance = await DenarioGold.balanceOf.staticCall(user.address)
			const balanceAndFee = await DenarioGold.balanceOfWithFee.staticCall(
				user.address,
			)
			const fee = balanceAndFee - balance

			const expectedFee = (BigInt(100) * feeRate) / BigInt(2)

			expect(fee).to.equal(expectedFee)
		})
		it("fees from dust amounts", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			const user = users[0]

			const amount = ethers.parseUnits("0.00000001", decimals)

			await fundFromDeployer(DenarioGold, minter, user.address, amount)
			const balanceBefore = await DenarioGold.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(MONTH)

			const balance = await DenarioGold.balanceOf(user.address)

			const balanceAndFee = await DenarioGold.balanceOfWithFee(
				user.address,
			)

			expect(balance).to.equal(amount)
			expect(balanceAndFee).to.equal(amount)
		})
	})

	describe("Burn", () => {
		it("only by minter role", async () => {
			const { minter, DenarioGold, users, decimals } = await setup()

			let user = users[0]

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			await expect(
				DenarioGold.connect(user).burnFrom(user.address, amount),
			).to.be.revertedWithCustomError(DenarioGold, "NotMinter")
		})

		it("needs allowance", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			const user = users[0]
			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			await expect(DenarioGold.burnFrom(user.address, amount)).to.be
				.reverted
		})

		it("burns tokens", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			const user = users[0]
			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DenarioGold, minter, user.address, amount)

			await DenarioGold.connect(user).approve(minter.address, amount)

			const balanceBefore = await DenarioGold.balanceOf(user.address)
			const supplyBefore = await DenarioGold.totalSupply()

			const burnAmount = ethers.parseUnits("1", decimals)
			await DenarioGold.connect(minter).burnFrom(user.address, burnAmount)

			const balanceAfter = await DenarioGold.balanceOf(user.address)
			const supplyAfter = await DenarioGold.totalSupply()

			expect(balanceAfter).to.be.closeTo(
				balanceBefore - burnAmount,
				BigInt(1 * 10 ** Number(decimals)),
			)
			expect(supplyAfter).to.equal(supplyBefore - burnAmount)
		})
	})

	describe("Mint", () => {
		it("only minter", async () => {
			const { DenarioGold, users, decimals } = await setup()

			const amount = ethers.parseUnits("100", decimals)

			await expect(
				DenarioGold.connect(users[0]).mint(amount),
			).to.be.revertedWithCustomError(DenarioGold, `NotMinter`)
		})

		it("mints to minter address", async () => {
			const { DenarioGold, minter, decimals } = await setup()

			const amount = ethers.parseUnits("100", decimals)

			const supplyBefore = await DenarioGold.totalSupply()
			const balanceBefore = await DenarioGold.balanceOf(minter.address)

			await DenarioGold.connect(minter).mint(amount)

			const supplyAfter = await DenarioGold.totalSupply()
			const balanceAfter = await DenarioGold.balanceOf(minter.address)

			expect(supplyAfter).to.equal(supplyBefore + amount)
			expect(balanceAfter).to.equal(balanceBefore + amount)
		})
	})

	describe("Fee exemption", () => {
		it("exempt addresses do not pay fees", async () => {
			const { DenarioGold, feeCollector } = await setup()

			const balanceBefore = await DenarioGold.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeBefore = await DenarioGold.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(MONTH * 1000)

			const balanceAfter = await DenarioGold.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeAfter = await DenarioGold.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe("set new fee collection address", () => {
		it("only owner", async () => {
			const { DenarioGold, users } = await setup()

			const user = users[0]

			await expect(
				DenarioGold.connect(user).setFeeCollectionAddress(user.address),
			).to.be.reverted
		})

		it("Cannot be zero address", async () => {
			const { DenarioGold } = await setup()
			await expect(
				DenarioGold.setFeeCollectionAddress(ZeroAddress),
			).to.be.revertedWithCustomError(DenarioGold, `InvalidFeeCollector`)
		})

		it("Set new fee collector", async () => {
			const { DenarioGold, users, feeCollector } = await setup()

			const user = users[0]
			await expect(DenarioGold.setFeeCollectionAddress(user.address)).to
				.not.be.reverted

			const lastPaid = await DenarioGold.feeLastPaid(feeCollector.address)
			const latestBlockTime = await time.latest()

			expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe("Set new minter address", () => {
		it("only owner", async () => {
			const { DenarioGold, users } = await setup()
			const user = users[10]
			await expect(DenarioGold.connect(user).setMinterRole(user.address))
				.to.be.reverted
		})

		it("cannot be zero address", async () => {
			const { DenarioGold } = await setup()
			await expect(
				DenarioGold.setMinterRole(ZeroAddress),
			).to.be.revertedWithCustomError(DenarioGold, `InvalidMiner`)
		})

		it("set up new minter role", async () => {
			const { DenarioGold, users } = await setup()
			const newMinter = users[10]
			await expect(DenarioGold.setMinterRole(newMinter.address)).to.not.be
				.reverted
			// TODO: is this needed here?
			// const lastPaid = await DenarioGold.feeLastPaid(minter.address)
			// const latestBlockTime = await time.latest()

			// expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe("Set new fee rate", () => {
		it("Only owner", async () => {
			const { DenarioGold, users } = await setup()

			let user = users[0]

			await expect(
				DenarioGold.connect(user).setFeeRate(ethers.parseUnits("1", 8)),
			).to.be.reverted
		})

		it("Cannot be more than max", async () => {
			const { DenarioGold } = await setup()

			let feeLastChanged = await DenarioGold.lastFeeChange()
			let max = await DenarioGold.maxFee()
			await expect(
				DenarioGold.setFeeRate(max + BigInt(1)),
			).to.be.revertedWithCustomError(DenarioGold, `MaxFeeExceeded`)
			let feeLastChangedAfter = await DenarioGold.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it("delay ", async () => {
			const { DenarioGold } = await setup()

			const fee = await DenarioGold.feeRate()

			let feeLastChanged = await DenarioGold.lastFeeChange()

			await expect(
				DenarioGold.setFeeRate(fee + BigInt(1)),
			).to.be.revertedWithCustomError(DenarioGold, `FeeChangeTooSoon`)

			let feeLastChangedAfter = await DenarioGold.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it("Set new fee rate", async () => {
			const { DenarioGold } = await setup()

			let delay = await DenarioGold.feeChangeMinDelay()

			const fee = await DenarioGold.feeRate()

			let latestBlockTime = await time.latest()
			let travelTo = BigInt(latestBlockTime) + delay

			await time.increaseTo(travelTo)

			await expect(DenarioGold.setFeeRate(fee + BigInt(1))).to.not.be
				.reverted
			let feeLastChangedAfter = await DenarioGold.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo + BigInt(1))
		})

		it("forgets outstanding debt with old fee rate", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			const user = users[0]
			await fundFromDeployer(
				DenarioGold,
				minter,
				user.address,
				ethers.parseUnits("1", decimals),
			)

			await timeJumpForward(MONTH)

			let balancBefore = await DenarioGold.balanceOf.staticCall(
				user.address,
			)
			let balanceWithFeeBefore =
				await DenarioGold.balanceOfWithFee.staticCall(user.address)

			expect(balancBefore).to.not.be.equal(balanceWithFeeBefore)

			let delay = await DenarioGold.feeChangeMinDelay()
			let latestBlockTime = await time.latest()
			let travelTo = BigInt(latestBlockTime) + delay

			await time.increaseTo(travelTo)

			const fee = await DenarioGold.feeRate()

			await expect(DenarioGold.setFeeRate(fee + BigInt(1))).to.not.be
				.reverted
			let feeLastChangedAfter = await DenarioGold.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo + BigInt(1))

			let balanceAfter = await DenarioGold.balanceOf.staticCall(
				user.address,
			)
			let balanceWithFeeAfter =
				await DenarioGold.balanceOfWithFee.staticCall(user.address)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe("Oracle", () => {
		it("initially set as zero address", async () => {
			const { DenarioGold } = await setup()

			const oracle = await DenarioGold.oracle()
			expect(oracle).to.equal(ZeroAddress)
		})

		it("cannot be zero address", async () => {
			const { DenarioGold } = await setup()
			await expect(
				DenarioGold.setOracleAddress(ZeroAddress),
			).to.be.revertedWithCustomError(DenarioGold, `InvalidOracle`)
		})

		it("only owner", async () => {
			const { DenarioGold, users } = await setup()

			const user = users[0]

			await expect(
				DenarioGold.connect(user).setOracleAddress(user.address),
			).to.be.reverted
		})

		it("can be changed", async () => {
			const { DenarioGold, users } = await setup()

			const user = users[0]
			await DenarioGold.setOracleAddress(user.address)

			const oracle = await DenarioGold.oracle()
			expect(oracle).to.equal(user.address)
		})

		it("limits token minting if set", async () => {
			const { DenarioGold, minter, Oracle } = await setup()

			await DenarioGold.setOracleAddress(await Oracle.getAddress())

			const max = await Oracle.lockedValue()

			await expect(
				DenarioGold.connect(minter).mint(max + BigInt(1)),
			).to.be.revertedWithCustomError(DenarioGold, `MintingLimitExceeded`)
		})

		it("allowa minting if under limit", async () => {
			const { DenarioGold, minter, Oracle } = await setup()

			await DenarioGold.setOracleAddress(await Oracle.getAddress())

			const max = await Oracle.lockedValue()
			const supplyBefore = await DenarioGold.totalSupply()

			await DenarioGold.connect(minter).mint(max - supplyBefore)

			const supply = await DenarioGold.totalSupply()
			expect(supply).to.equal(max)
		})
	})

	describe("Whitelist addresses", () => {
		it("non owner reverts", async () => {
			const { DenarioGold, users } = await setup()

			const user = users[1]

			await expect(DenarioGold.connect(user).setFeeExempt(user.address))
				.to.be.reverted

			await expect(DenarioGold.connect(user).unsetFeeExempt(user.address))
				.to.be.reverted
		})

		it("owner can whitelist", async () => {
			const { DenarioGold, users } = await setup()

			const user = users[1]

			let isExempt = await DenarioGold.feeExempt(user.address)
			expect(isExempt).to.be.false

			await expect(DenarioGold.setFeeExempt(user.address)).to.not.be
				.reverted

			isExempt = await DenarioGold.feeExempt(user.address)
			expect(isExempt).to.be.true

			await expect(DenarioGold.unsetFeeExempt(user.address)).to.not.be
				.reverted

			isExempt = await DenarioGold.feeExempt(user.address)
			expect(isExempt).to.be.false
		})

		it("exempt addresses do not pay fees", async () => {
			const { DenarioGold, feeCollector } = await setup()

			const balanceBefore = await DenarioGold.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeBefore = await DenarioGold.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(MONTH * 1000)

			const balanceAfter = await DenarioGold.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeAfter = await DenarioGold.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe("Test Upgrade", () => {
		var DenarioGoldV2Address: string
		beforeEach(async () => {
			const {} = await setup()

			// Deploy new implementation
			const NewDenarioGold =
				await ethers.getContractFactory("DenarioGoldV2")
			const newDenarioGold = await NewDenarioGold.deploy()
			await newDenarioGold.waitForDeployment()

			DenarioGoldV2Address = await newDenarioGold.getAddress()
		})

		it("Upgrade only by owner", async () => {
			const { DenarioGold, users } = await setup()

			const user = users[0]

			await expect(
				DenarioGold.connect(user).upgradeToAndCall(user.address, "0x"),
			).to.be.reverted
		})
		it("Upgrade to new contract", async () => {
			const { DenarioGold, owner } = await setup()

			let contractOwner = await DenarioGold.owner()
			expect(owner).to.be.eq(contractOwner)

			await DenarioGold.upgradeToAndCall(DenarioGoldV2Address, "0x")
		})
		it("Upgraded version is returned", async () => {
			const { DenarioGold, owner } = await setup()
			await DenarioGold.connect(owner).upgradeToAndCall(
				DenarioGoldV2Address,
				"0x",
			)
			expect(await DenarioGold.version()).to.equal(2)
		})
		it("Ledger and state is preserved", async () => {
			const {
				DenarioGold,
				owner,
				minter,
				users,
				decimals,
				feePrecision,
			} = await setup()

			const user = users[0]
			const user2 = users[1]
			const amount = ethers.parseUnits("100", decimals)
			const approveAmount = ethers.parseUnits("50", decimals)

			await fundFromDeployer(DenarioGold, minter, user.address, amount)
			const fundTs = await time.latest()

			await DenarioGold.connect(user).approve(
				user2.address,
				approveAmount,
			)

			const feeLastPaidBefore = await DenarioGold.feeLastPaid(
				user.address,
			)
			const feeRateBefore = await DenarioGold.feeRate()
			const maxFeeBefore = await DenarioGold.maxFee()
			const totalSupplyBefore = await DenarioGold.totalSupply()
			const lastFeeChangeBefore = await DenarioGold.lastFeeChange()
			const feeChangeMinDelayBefore =
				await DenarioGold.feeChangeMinDelay()
			const oracleBefore = await DenarioGold.oracle()
			const balanceWithFeeBefore = await DenarioGold.balanceOfWithFee(
				user.address,
			)
			const allowanceBefore = await DenarioGold.allowance(
				user.address,
				user2.address,
			)

			await DenarioGold.connect(owner).upgradeToAndCall(
				DenarioGoldV2Address,
				"0x",
			)

			// Check if the state is preserved
			const feeLastPaidAfter = await DenarioGold.feeLastPaid(user.address)
			const feeRateAfter = await DenarioGold.feeRate()
			const maxFeeAfter = await DenarioGold.maxFee()
			const totalSupplyAfter = await DenarioGold.totalSupply()
			const lastFeeChangeAfter = await DenarioGold.lastFeeChange()
			const feeChangeMinDelayAfter = await DenarioGold.feeChangeMinDelay()
			const oracleAfter = await DenarioGold.oracle()
			const balanceWithFeeAfter = await DenarioGold.balanceOfWithFee(
				user.address,
			)
			const allowanceAfter = await DenarioGold.allowance(
				user.address,
				user2.address,
			)

			expect(feeLastPaidBefore).to.equal(feeLastPaidAfter)
			expect(feeRateBefore).to.equal(feeRateAfter)
			expect(maxFeeBefore).to.equal(maxFeeAfter)
			expect(totalSupplyBefore).to.equal(totalSupplyAfter)
			expect(lastFeeChangeBefore).to.equal(lastFeeChangeAfter)
			expect(feeChangeMinDelayBefore).to.equal(feeChangeMinDelayAfter)
			expect(oracleBefore).to.equal(oracleAfter)
			expect(balanceWithFeeBefore).to.equal(balanceWithFeeAfter)
			expect(allowanceBefore).to.equal(allowanceAfter)

			// Check if the ledger is preserved
			const fundTsAfter = await time.latest()
			let elapsed = fundTsAfter - fundTs

			let expectedFee =
				(BigInt(feeRateAfter) * BigInt(elapsed) * BigInt(amount)) /
				feePrecision
			let expectedBalance = amount - expectedFee
			const balanceAfter = await DenarioGold.balanceOf(user.address)

			expect(balanceAfter).to.equal(expectedBalance)

			// transferFrom
			await DenarioGold.connect(user2).transferFrom(
				user.address,
				user2.address,
				approveAmount,
			)
			const balanceAfter2 = await DenarioGold.balanceOf(user2.address)
			expect(balanceAfter2).to.equal(approveAmount)
		})
	})

	describe("Test increase allowance", () => {
		it("increase allowance", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			const user = users[0]
			const spender = users[1]

			const amount = ethers.parseUnits("100", decimals)
			const initialBalance = amount * BigInt(3)
			await fundFromDeployer(
				DenarioGold,
				minter,
				user.address,
				initialBalance,
			)

			const allowanceBefore = await DenarioGold.allowance(
				user.address,
				spender.address,
			)

			await DenarioGold.connect(user).increaseAllowance(
				spender.address,
				amount,
			)

			const allowanceAfter = await DenarioGold.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter).to.equal(allowanceBefore + amount)

			await DenarioGold.connect(user).increaseAllowance(
				spender.address,
				amount,
			)

			const allowanceAfter2 = await DenarioGold.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter2).to.equal(allowanceAfter + amount)

			// allowance can be used
			await DenarioGold.connect(user).approve(spender.address, amount)
			await DenarioGold.connect(spender).transferFrom(
				user.address,
				spender.address,
				amount,
			)

			const balanceAfter = await DenarioGold.balanceOf(user.address)
			expect(balanceAfter).to.closeTo(initialBalance - amount, 100)
			const senderBalance = await DenarioGold.balanceOf(spender.address)
			expect(senderBalance).to.equal(amount)
		})

		it("decrease allowance", async () => {
			const { DenarioGold, minter, users, decimals } = await setup()

			const user = users[0]
			const spender = users[1]

			const initialBalance = ethers.parseUnits("100", decimals)
			const amount = ethers.parseUnits("1", decimals)

			await fundFromDeployer(
				DenarioGold,
				minter,
				user.address,
				initialBalance,
			)

			await DenarioGold.connect(user).increaseAllowance(
				spender.address,
				initialBalance,
			)

			const allowanceBefore = await DenarioGold.allowance(
				user.address,
				spender.address,
			)

			await DenarioGold.connect(user).decreaseAllowance(
				spender.address,
				amount,
			)

			const allowanceAfter = await DenarioGold.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter).to.equal(allowanceBefore - amount)

			await DenarioGold.connect(user).decreaseAllowance(
				spender.address,
				amount,
			)

			const allowanceAfter2 = await DenarioGold.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter2).to.equal(allowanceAfter - amount)

			await expect(
				DenarioGold.connect(user).decreaseAllowance(
					spender.address,
					initialBalance,
				),
			).to.be.revertedWithCustomError(DenarioGold, `AllowanceBelowZero`)
		})
	})
})
