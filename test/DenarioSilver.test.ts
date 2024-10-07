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
	DSC,
	DSC__factory,
	DSCV2,
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

	const name = "Denario Test Coin"
	const symbol = "DTC"
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

	const dsc: DSC = DSC__factory.connect(await proxy.getAddress(), owner)

	// const feeRate = await dsc.feeRate()

	const decimals = await dsc.decimals()
	const feeprecision = BigInt(365 * 24 * 60 * 60 * 10 ** Number(decimals))

	await dsc.connect(minter).mint(SUPPLY)

	const oracleInstance: MockOracle = MockOracle__factory.connect(
		await oracle.getAddress(),
		owner,
	)

	return {
		DSC: dsc.connect(owner),
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

describe("Denario Silver Coin (DSC)", () => {
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
			const { DSC, owner } = await setup()
			let actualOwner = await DSC.owner()
			expect(actualOwner).to.equal(owner.address)
		})
	})

	describe("Balance", () => {
		it("shows correct balance", async () => {
			const { DSC, users, minter, decimals, feeRate } = await setup()

			const user = users[1]

			const amount = ethers.parseUnits("1", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			let balanceBefore = await DSC.balanceOf(user.address)
			let balanceBeforeWithFees = await DSC.balanceOfWithFee(user.address)

			expect(balanceBefore).to.equal(amount)
			expect(balanceBeforeWithFees).to.equal(amount)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(YEAR)

			const balanceAfter = await DSC.balanceOf(user.address)
			const balanceWithFeesAfter = await DSC.balanceOfWithFee(
				user.address,
			)

			let expectedFee =
				(BigInt(amount) * BigInt(feeRate)) /
				BigInt(10 ** Number(decimals))

			expect(balanceAfter).to.equal(balanceBefore - expectedFee)
			expect(balanceWithFeesAfter).to.equal(amount)
		})
		it("shoes correct balance after some time", async () => {
			const { DSC, minter, users, decimals, feeRate, feePrecision } =
				await setup()

			const user = users[1]

			const amount = ethers.parseUnits("1", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			let balanceBefore = await DSC.balanceOf(user.address)
			let balanceBeforeWithFees = await DSC.balanceOfWithFee(user.address)

			expect(balanceBefore).to.equal(amount)
			expect(balanceBeforeWithFees).to.equal(amount)

			expect(balanceBefore).to.equal(amount)
			const beforeTS = await time.latest()

			const randomDays = BigInt(24 * 60 * 60 * getRandomInt(5, 15))
			await timeJumpForward(randomDays)
			const afterTS = await time.latest()

			const balanceAfter = await DSC.balanceOf(user.address)
			const balanceWithFeesAfter = await DSC.balanceOfWithFee(
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
			const { DSC, minter, users, decimals } = await setup()
			const user = users[6]

			const amount = ethers.parseUnits("0.00000001", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			await timeJumpForward(101 * 365 * 24 * 60 * 60)

			const balance = await DSC.balanceOf(user.address)
			const balanceWithFees = await DSC.balanceOfWithFee(user.address)

			expect(balance).to.equal(0)
			expect(balanceWithFees).to.equal(amount)
		})

		it("reports 0 balance if fee is more than balance", async () => {
			const { DSC, minter, users } = await setup()

			const user = users[0]

			const amount = BigInt(1)
			await fundFromDeployer(DSC, minter, user.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60 * 100 + 1)

			const balance = await DSC.balanceOf(user.address)
			const balanceWithFees = await DSC.balanceOfWithFee(user.address)

			expect(balance).to.equal(0)
			expect(balanceWithFees).to.equal(1)
		})
	})

	describe("Transfer", () => {
		it("always possible to transfer all tokens", async () => {
			const { DSC, minter, users, decimals } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DSC, minter, sender.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await DSC.balanceOf.staticCall(sender.address)

			await DSC.connect(sender).transferAll(receiver.address)

			let balance = await DSC.balanceOf.staticCall(sender.address)
			let balanceAndFee = await DSC.balanceOfWithFee.staticCall(
				sender.address,
			)
			let fee = balanceAndFee - balance

			expect(balance).to.equal(0)
			expect(fee).to.equal(0)

			let receiverBalance = await DSC.balanceOf.staticCall(
				receiver.address,
			)
			let receiverFee = balanceAndFee - balance

			expect(receiverBalance).to.be.closeTo(balanceBefore, 10)

			expect(receiverFee).to.equal(0)
		})
		it("always possible to transfer all tokens: dust", async () => {
			const { DSC, minter, users } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount: bigint = BigInt(1)
			await fundFromDeployer(DSC, minter, sender.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await DSC.balanceOf.staticCall(sender.address)

			await DSC.connect(sender).transferAll(receiver.address)

			let balance = await DSC.balanceOf.staticCall(sender.address)
			let balanceAndFee = await DSC.balanceOfWithFee.staticCall(
				sender.address,
			)
			let fee = balanceAndFee - balance

			expect(balance).to.equal(0)
			expect(fee).to.equal(0)

			let receiverBalance = await DSC.balanceOf.staticCall(
				receiver.address,
			)
			let receiverFee = balanceAndFee - balance

			expect(receiverBalance).to.be.closeTo(balanceBefore, 10)
			expect(receiverFee).to.equal(0)
		})
	})

	describe("Fee last paid", () => {
		it("initialised after receiving tokens", async () => {
			const { DSC, minter, users, decimals } = await setup()

			let user = users[0]

			const amount = ethers.parseUnits("100", decimals)

			await fundFromDeployer(
				DSC,
				minter,
				user.address,
				amount * BigInt(2),
			)

			const timeStamp = await time.latest()

			let feeLastPaid = await DSC.feeLastPaid(user.address)
			expect(feeLastPaid).to.equal(timeStamp)
		})

		it("receiving tokens updates", async () => {
			const { DSC, minter, users, decimals } = await setup()

			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(
				DSC,
				minter,
				sender.address,
				amount * BigInt(2),
			)

			let feeLastPaid = await DSC.feeLastPaid(receiver.address)

			expect(feeLastPaid).to.equal(0)

			await DSC.connect(sender).transfer(receiver.address, amount)

			const timeStamp = await time.latest()
			feeLastPaid = await DSC.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(timeStamp)
		})
	})

	describe("Fee collection", () => {
		it("trigger fee deduction", async () => {
			const { DSC, minter, users, decimals } = await setup()
			const user = users[0]

			await fundFromDeployer(
				DSC,
				minter,
				user.address,
				ethers.parseUnits("1", decimals),
			)

			await timeJumpForward(365 * 24 * 60 * 60)

			await DSC.connect(user).collectFees([user.address])
		})
		it("collects 100% fees", async () => {
			const { DSC, minter, users, decimals, feeRate } = await setup()

			let necessaryTime =
				(BigInt(10 ** Number(decimals)) / feeRate) *
					BigInt(365 * 24 * 60 * 60) +
				BigInt(1)

			const user = users[0]
			const amount = ethers.parseUnits("100", decimals)

			await fundFromDeployer(DSC, minter, user.address, amount)

			await timeJumpForward(necessaryTime)

			const balance = await DSC.balanceOf(user.address)
			const balanceWithFee = await DSC.balanceOfWithFee(user.address)

			expect(balanceWithFee).to.equal(amount)
			expect(balance).to.equal(0)

			await expect(DSC.connect(user).collectFees([user.address]))

			const balanceAfterCollection = await DSC.balanceOf(user.address)
			const balanceWithFeeAdterCollection = await DSC.balanceOfWithFee(
				user.address,
			)

			expect(balanceAfterCollection).to.equal(0)
			expect(balanceWithFeeAdterCollection).to.equal(0)
		})
	})

	describe("Calculate fees", () => {
		it("fees deducted from balance correctly", async () => {
			const { DSC, minter, users, decimals, feeRate } = await setup()

			const user = users[0]

			expect(await DSC.balanceOf(user.address)).to.equal(0)
			expect(await DSC.balanceOfWithFee(user.address)).to.equal(0)

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			const balanceBefore = await DSC.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			const t = (365 * 24 * 60 * 60) / 2 // 1/2 year
			await timeJumpForward(t)

			const balance = await DSC.balanceOf.staticCall(user.address)
			const balanceAndFee = await DSC.balanceOfWithFee.staticCall(
				user.address,
			)
			const fee = balanceAndFee - balance

			const expectedFee = (BigInt(100) * feeRate) / BigInt(2)

			expect(fee).to.equal(expectedFee)
		})
		it("fees from dust amounts", async () => {
			const { DSC, minter, users, decimals } = await setup()

			const user = users[0]

			const amount = ethers.parseUnits("0.00000001", decimals)

			await fundFromDeployer(DSC, minter, user.address, amount)
			const balanceBefore = await DSC.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(MONTH)

			const balance = await DSC.balanceOf(user.address)

			const balanceAndFee = await DSC.balanceOfWithFee(user.address)

			expect(balance).to.equal(amount)
			expect(balanceAndFee).to.equal(amount)
		})
	})

	describe("Burn", () => {
		it("only by minter role", async () => {
			const { minter, DSC, users, decimals } = await setup()

			let user = users[0]

			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			await expect(
				DSC.connect(user).burnFrom(user.address, amount),
			).to.be.revertedWithCustomError(DSC, "NotMinter")
		})

		it("needs allowance", async () => {
			const { DSC, minter, users, decimals } = await setup()

			const user = users[0]
			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			await expect(DSC.burnFrom(user.address, amount)).to.be.reverted
		})

		it("burns tokens", async () => {
			const { DSC, minter, users, decimals } = await setup()

			const user = users[0]
			const amount = ethers.parseUnits("100", decimals)
			await fundFromDeployer(DSC, minter, user.address, amount)

			await DSC.connect(user).approve(minter.address, amount)

			const balanceBefore = await DSC.balanceOf(user.address)
			const supplyBefore = await DSC.totalSupply()

			const burnAmount = ethers.parseUnits("1", decimals)
			await DSC.connect(minter).burnFrom(user.address, burnAmount)

			const balanceAfter = await DSC.balanceOf(user.address)
			const supplyAfter = await DSC.totalSupply()

			expect(balanceAfter).to.be.closeTo(
				balanceBefore - burnAmount,
				BigInt(1 * 10 ** Number(decimals)),
			)
			expect(supplyAfter).to.equal(supplyBefore - burnAmount)
		})
	})

	describe("Mint", () => {
		it("only minter", async () => {
			const { DSC, users, decimals } = await setup()

			const amount = ethers.parseUnits("100", decimals)

			await expect(
				DSC.connect(users[0]).mint(amount),
			).to.be.revertedWithCustomError(DSC, `NotMinter`)
		})

		it("mints to minter address", async () => {
			const { DSC, minter, decimals } = await setup()

			const amount = ethers.parseUnits("100", decimals)

			const supplyBefore = await DSC.totalSupply()
			const balanceBefore = await DSC.balanceOf(minter.address)

			await DSC.connect(minter).mint(amount)

			const supplyAfter = await DSC.totalSupply()
			const balanceAfter = await DSC.balanceOf(minter.address)

			expect(supplyAfter).to.equal(supplyBefore + amount)
			expect(balanceAfter).to.equal(balanceBefore + amount)
		})
	})

	describe("Fee exemption", () => {
		it("exempt addresses do not pay fees", async () => {
			const { DSC, feeCollector } = await setup()

			const balanceBefore = await DSC.balanceOf(feeCollector.address)
			const balanceWithFeeBefore = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(MONTH * 1000)

			const balanceAfter = await DSC.balanceOf(feeCollector.address)
			const balanceWithFeeAfter = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe("set new fee collection address", () => {
		it("only owner", async () => {
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(
				DSC.connect(user).setFeeCollectionAddress(user.address),
			).to.be.reverted
		})

		it("Cannot be zero address", async () => {
			const { DSC } = await setup()
			await expect(
				DSC.setFeeCollectionAddress(ZeroAddress),
			).to.be.revertedWithCustomError(DSC, `InvalidFeeCollector`)
		})

		it("Set new fee collector", async () => {
			const { DSC, users, feeCollector } = await setup()

			const user = users[0]
			await expect(DSC.setFeeCollectionAddress(user.address)).to.not.be
				.reverted

			const lastPaid = await DSC.feeLastPaid(feeCollector.address)
			const latestBlockTime = await time.latest()

			expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe("Set new minter address", () => {
		it("only owner", async () => {
			const { DSC, users } = await setup()
			const user = users[10]
			await expect(DSC.connect(user).setMinterRole(user.address)).to.be
				.reverted
		})

		it("cannot be zero address", async () => {
			const { DSC } = await setup()
			await expect(
				DSC.setMinterRole(ZeroAddress),
			).to.be.revertedWithCustomError(DSC, `InvalidMiner`)
		})

		it("set up new minter role", async () => {
			const { DSC, users } = await setup()
			const newMinter = users[10]
			await expect(DSC.setMinterRole(newMinter.address)).to.not.be
				.reverted
			// TODO: is this needed here?
			// const lastPaid = await DSC.feeLastPaid(minter.address)
			// const latestBlockTime = await time.latest()

			// expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe("Set new fee rate", () => {
		it("Only owner", async () => {
			const { DSC, users } = await setup()

			let user = users[0]

			await expect(
				DSC.connect(user).setFeeRate(ethers.parseUnits("1", 8)),
			).to.be.reverted
		})

		it("Cannot be more than max", async () => {
			const { DSC } = await setup()

			let feeLastChanged = await DSC.lastFeeChange()
			let max = await DSC.maxFee()
			await expect(
				DSC.setFeeRate(max + BigInt(1)),
			).to.be.revertedWithCustomError(DSC, `MaxFeeExceeded`)
			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it("delay ", async () => {
			const { DSC } = await setup()

			const fee = await DSC.feeRate()

			let feeLastChanged = await DSC.lastFeeChange()

			await expect(
				DSC.setFeeRate(fee + BigInt(1)),
			).to.be.revertedWithCustomError(DSC, `FeeChangeTooSoon`)

			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it("Set new fee rate", async () => {
			const { DSC } = await setup()

			let delay = await DSC.feeChangeMinDelay()

			const fee = await DSC.feeRate()

			let latestBlockTime = await time.latest()
			let travelTo = BigInt(latestBlockTime) + delay

			await time.increaseTo(travelTo)

			await expect(DSC.setFeeRate(fee + BigInt(1))).to.not.be.reverted
			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo + BigInt(1))
		})

		it("forgets outstanding debt with old fee rate", async () => {
			const { DSC, minter, users, decimals } = await setup()

			const user = users[0]
			await fundFromDeployer(
				DSC,
				minter,
				user.address,
				ethers.parseUnits("1", decimals),
			)

			await timeJumpForward(MONTH)

			let balancBefore = await DSC.balanceOf.staticCall(user.address)
			let balanceWithFeeBefore = await DSC.balanceOfWithFee.staticCall(
				user.address,
			)

			expect(balancBefore).to.not.be.equal(balanceWithFeeBefore)

			let delay = await DSC.feeChangeMinDelay()
			let latestBlockTime = await time.latest()
			let travelTo = BigInt(latestBlockTime) + delay

			await time.increaseTo(travelTo)

			const fee = await DSC.feeRate()

			await expect(DSC.setFeeRate(fee + BigInt(1))).to.not.be.reverted
			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo + BigInt(1))

			let balanceAfter = await DSC.balanceOf.staticCall(user.address)
			let balanceWithFeeAfter = await DSC.balanceOfWithFee.staticCall(
				user.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe("Oracle", () => {
		it("initially set as zero address", async () => {
			const { DSC } = await setup()

			const oracle = await DSC.oracle()
			expect(oracle).to.equal(ZeroAddress)
		})

		it("cannot be zero address", async () => {
			const { DSC } = await setup()
			await expect(
				DSC.setOracleAddress(ZeroAddress),
			).to.be.revertedWithCustomError(DSC, `InvalidOracle`)
		})

		it("only owner", async () => {
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(DSC.connect(user).setOracleAddress(user.address)).to.be
				.reverted
		})

		it("can be changed", async () => {
			const { DSC, users } = await setup()

			const user = users[0]
			await DSC.setOracleAddress(user.address)

			const oracle = await DSC.oracle()
			expect(oracle).to.equal(user.address)
		})

		it("limits token minting if set", async () => {
			const { DSC, minter, Oracle } = await setup()

			await DSC.setOracleAddress(await Oracle.getAddress())

			const max = await Oracle.lockedValue()

			await expect(
				DSC.connect(minter).mint(max + BigInt(1)),
			).to.be.revertedWithCustomError(DSC, `MintingLimitExceeded`)
		})

		it("allowa minting if under limit", async () => {
			const { DSC, minter, Oracle } = await setup()

			await DSC.setOracleAddress(await Oracle.getAddress())

			const max = await Oracle.lockedValue()
			const supplyBefore = await DSC.totalSupply()

			await DSC.connect(minter).mint(max - supplyBefore)

			const supply = await DSC.totalSupply()
			expect(supply).to.equal(max)
		})
	})

	describe("Whitelist addresses", () => {
		it("non owner reverts", async () => {
			const { DSC, users } = await setup()

			const user = users[1]

			await expect(DSC.connect(user).setFeeExempt(user.address)).to.be
				.reverted

			await expect(DSC.connect(user).unsetFeeExempt(user.address)).to.be
				.reverted
		})

		it("owner can whitelist", async () => {
			const { DSC, users } = await setup()

			const user = users[1]

			let isExempt = await DSC.feeExempt(user.address)
			expect(isExempt).to.be.false

			await expect(DSC.setFeeExempt(user.address)).to.not.be.reverted

			isExempt = await DSC.feeExempt(user.address)
			expect(isExempt).to.be.true

			await expect(DSC.unsetFeeExempt(user.address)).to.not.be.reverted

			isExempt = await DSC.feeExempt(user.address)
			expect(isExempt).to.be.false
		})

		it("exempt addresses do not pay fees", async () => {
			const { DSC, feeCollector } = await setup()

			const balanceBefore = await DSC.balanceOf(feeCollector.address)
			const balanceWithFeeBefore = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(MONTH * 1000)

			const balanceAfter = await DSC.balanceOf(feeCollector.address)
			const balanceWithFeeAfter = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
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
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(DSC.connect(user).upgradeToAndCall(user.address, "0x"))
				.to.be.reverted
		})
		it("Upgrade to new contract", async () => {
			const { DSC, owner } = await setup()

			let contractOwner = await DSC.owner()
			expect(owner).to.be.eq(contractOwner)

			await DSC.upgradeToAndCall(DSCV2Address, "0x")
		})
		it("Upgraded version is returned", async () => {
			const { DSC, owner } = await setup()
			await DSC.connect(owner).upgradeToAndCall(DSCV2Address, "0x")
			expect(await DSC.version()).to.equal(2)
		})
		it("Ledger and state is preserved", async () => {
			const { DSC, owner, minter, users, decimals, feePrecision } =
				await setup()

			const user = users[0]
			const user2 = users[1]
			const amount = ethers.parseUnits("100", decimals)
			const approveAmount = ethers.parseUnits("50", decimals)

			await fundFromDeployer(DSC, minter, user.address, amount)
			const fundTs = await time.latest()

			await DSC.connect(user).approve(user2.address, approveAmount)

			const feeLastPaidBefore = await DSC.feeLastPaid(user.address)
			const feeRateBefore = await DSC.feeRate()
			const maxFeeBefore = await DSC.maxFee()
			const totalSupplyBefore = await DSC.totalSupply()
			const lastFeeChangeBefore = await DSC.lastFeeChange()
			const feeChangeMinDelayBefore = await DSC.feeChangeMinDelay()
			const oracleBefore = await DSC.oracle()
			const balanceWithFeeBefore = await DSC.balanceOfWithFee(
				user.address,
			)
			const allowanceBefore = await DSC.allowance(
				user.address,
				user2.address,
			)

			await DSC.connect(owner).upgradeToAndCall(DSCV2Address, "0x")

			// Check if the state is preserved
			const feeLastPaidAfter = await DSC.feeLastPaid(user.address)
			const feeRateAfter = await DSC.feeRate()
			const maxFeeAfter = await DSC.maxFee()
			const totalSupplyAfter = await DSC.totalSupply()
			const lastFeeChangeAfter = await DSC.lastFeeChange()
			const feeChangeMinDelayAfter = await DSC.feeChangeMinDelay()
			const oracleAfter = await DSC.oracle()
			const balanceWithFeeAfter = await DSC.balanceOfWithFee(user.address)
			const allowanceAfter = await DSC.allowance(
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
			const balanceAfter = await DSC.balanceOf(user.address)

			expect(balanceAfter).to.equal(expectedBalance)

			// transferFrom
			await DSC.connect(user2).transferFrom(
				user.address,
				user2.address,
				approveAmount,
			)
			const balanceAfter2 = await DSC.balanceOf(user2.address)
			expect(balanceAfter2).to.equal(approveAmount)
		})
		// it("Set lower fee rate", async () => {
		// 	const { DSC, owner } = await setup()

		// 	await DSC.connect(owner).upgradeToAndCall(DSCV2Address, "0x")
		// 	const oldFee = await DSC.feeRate()

		// 	await DSC.connect(owner).reduceFeeRate(0)

		// 	const currentFee = await DSC.feeRate()
		// 	expect(currentFee).to.be.lessThan(oldFee)

		// 	const newFee = await DSC.feeRate()
		// 	expect(newFee).to.equal(0)
		// })
	})

	describe("Test increase allowance", () => {
		it("increase allowance", async () => {
			const { DSC, minter, users, decimals } = await setup()

			const user = users[0]
			const spender = users[1]

			const amount = ethers.parseUnits("100", decimals)
			const initialBalance = amount * BigInt(3)
			await fundFromDeployer(DSC, minter, user.address, initialBalance)

			const allowanceBefore = await DSC.allowance(
				user.address,
				spender.address,
			)

			await DSC.connect(user).increaseAllowance(spender.address, amount)

			const allowanceAfter = await DSC.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter).to.equal(allowanceBefore + amount)

			await DSC.connect(user).increaseAllowance(spender.address, amount)

			const allowanceAfter2 = await DSC.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter2).to.equal(allowanceAfter + amount)

			// allowance can be used
			await DSC.connect(user).approve(spender.address, amount)
			await DSC.connect(spender).transferFrom(
				user.address,
				spender.address,
				amount,
			)

			const balanceAfter = await DSC.balanceOf(user.address)
			expect(balanceAfter).to.closeTo(initialBalance - amount, 100)
			const senderBalance = await DSC.balanceOf(spender.address)
			expect(senderBalance).to.equal(amount)
		})

		it("decrease allowance", async () => {
			const { DSC, minter, users, decimals } = await setup()

			const user = users[0]
			const spender = users[1]

			const initialBalance = ethers.parseUnits("100", decimals)
			const amount = ethers.parseUnits("1", decimals)

			await fundFromDeployer(DSC, minter, user.address, initialBalance)

			await DSC.connect(user).increaseAllowance(
				spender.address,
				initialBalance,
			)

			const allowanceBefore = await DSC.allowance(
				user.address,
				spender.address,
			)

			await DSC.connect(user).decreaseAllowance(spender.address, amount)

			const allowanceAfter = await DSC.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter).to.equal(allowanceBefore - amount)

			await DSC.connect(user).decreaseAllowance(spender.address, amount)

			const allowanceAfter2 = await DSC.allowance(
				user.address,
				spender.address,
			)

			expect(allowanceAfter2).to.equal(allowanceAfter - amount)

			await expect(
				DSC.connect(user).decreaseAllowance(
					spender.address,
					initialBalance,
				),
			).to.be.revertedWithCustomError(DSC, `AllowanceBelowZero`)
		})
	})
})
