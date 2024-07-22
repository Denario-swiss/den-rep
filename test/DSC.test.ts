import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat'
import { setupUsers, setupUser } from './utils'
import { expect, assert } from './chai-setup'
import { BigNumber, BigNumberish } from "@ethersproject/bignumber"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { DSC, MockOracle } from '../typechain-types'
import exp from 'constants'


const SUPPLY = ethers.utils.parseUnits('1000000', 8)
const month = 30 * 24 * 60 * 60


const fundFromDeployer = async (contract: DSC, address: string, amount: BigNumberish) => {
	await contract.transfer(address, amount)
}

const timeJumpForward = async (timestamp: number) => {
	const latestBlockTime = await time.latest()

	const travelTo = BigNumber.from(latestBlockTime).add(timestamp)
	await time.increaseTo(travelTo)
}

const setup = deployments.createFixture(async () => {

	await deployments.fixture(['DSC', 'MockOracle'])



	const contracts = {
		ERC20WithFees: <DSC>await ethers.getContract('DSC'),
		Oracle: <MockOracle>await ethers.getContract('MockOracle'),
	}

	// we get the tokenOwner
	const { deployer, feeCollector } = await getNamedAccounts()

	// Get the unnammedAccounts (which are basically all accounts not named in the config,
	// This is useful for tests as you can be sure they have noy been given tokens for example)
	// We then use the utilities function to generate user objects
	// These object allow you to write things like `users[0].Token.transfer(....)`
	const users = await setupUsers(await getUnnamedAccounts(), contracts)
	// finally we return the whole object (including the tokenOwner setup as a User object)


	await contracts.ERC20WithFees.mint(SUPPLY)

	const decimals = await contracts.ERC20WithFees.decimals()

	const namedUser = await setupUser(deployer, contracts)

	const feeRate = await contracts.ERC20WithFees.feeRate()

	return {
		...contracts,
		decimals: decimals,
		users,
		deployer: namedUser,
		feeCollector: namedUser,
		minter: namedUser,
		feeRate: feeRate
	}
})

describe('Erc20WithFees', () => {
	describe('Deployment', () => {
		it('shown correct deployment data', async () => {
			const { ERC20WithFees } = await setup()

			const name = await ERC20WithFees.name()
			const symbol = await ERC20WithFees.symbol()
			const decimals = await ERC20WithFees.decimals()
			const totalSupply = await ERC20WithFees.totalSupply()
			


		})

	})
	describe("Balance", () => {
		it("shows correct balance", async () => {
			const { ERC20WithFees, deployer, users, decimals, feeRate } = await setup()

			const user = users[6]

			const amount = ethers.utils.parseUnits('1', decimals)
			await fundFromDeployer(ERC20WithFees, user.address, amount)

			const balanceBefore = await ERC20WithFees.balanceOf(user.address)
			const balanceBeforeWithFees = await ERC20WithFees.balanceOfWithFee(user.address)

			expect(balanceBefore).to.equal(amount)
			expect(balanceBeforeWithFees).to.equal(amount)



			await timeJumpForward(365 * 24 * 60 * 60)

			const balanceAfter = await ERC20WithFees.balanceOf(user.address)
			const balanceWithFeesAfter = await ERC20WithFees.balanceOfWithFee(user.address)


			let expectedFee = amount.mul(feeRate).div(10 ** decimals)


			expect(balanceAfter).to.equal(amount.sub(expectedFee))
			expect(balanceWithFeesAfter).to.equal(amount)

		})

		it("shows correct balance: dust", async () => {
			const { ERC20WithFees, deployer, users, decimals } = await setup()
			const user = users[6]

			const amount = ethers.utils.parseUnits('0.00000001', decimals)
			await fundFromDeployer(ERC20WithFees, user.address, amount)

			await timeJumpForward(101 * 365 * 24 * 60 * 60)

			const balance = await ERC20WithFees.balanceOf(user.address)
			const balanceWithFees = await ERC20WithFees.balanceOfWithFee(user.address)

			expect(balance).to.equal(0)
			expect(balanceWithFees).to.equal(amount)


		})
	})

	describe("Transfer", () => {
		it("always possible to transfer all tokens", async () => {
			const { ERC20WithFees, deployer, users, decimals } = await setup()
			let sender = users[0]
			let receiver = users[1]


			const amount = ethers.utils.parseUnits('100', decimals)
			await fundFromDeployer(deployer.ERC20WithFees, sender.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await ERC20WithFees.callStatic.balanceOf(sender.address)

			await sender.ERC20WithFees.transferAll(receiver.address)

			let balance = await ERC20WithFees.callStatic.balanceOf(sender.address)
			let balanceAndFee = await ERC20WithFees.callStatic.balanceOfWithFee(sender.address)
			let fee = balanceAndFee.sub(balance)

			expect(balance).to.equal(BigNumber.from(0))
			expect(fee).to.equal(BigNumber.from(0))


			let receiverBalance = await ERC20WithFees.callStatic.balanceOf(receiver.address)
			let receiverFee = balanceAndFee.sub(balance)

			expect(receiverBalance.toNumber()).to.be.closeTo(balanceBefore.toNumber(), 10)

			expect(receiverFee).to.equal(BigNumber.from(0))


		})
		it("always possible to transfer all tokens: dust", async () => {
			const { ERC20WithFees, deployer, users, decimals } = await setup()
			let sender = users[0]
			let receiver = users[1]


			const amount = BigNumber.from(1)
			await fundFromDeployer(deployer.ERC20WithFees, sender.address, amount)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await ERC20WithFees.callStatic.balanceOf(sender.address)

			await sender.ERC20WithFees.transferAll(receiver.address)

			let balance = await ERC20WithFees.callStatic.balanceOf(sender.address)
			let balanceAndFee = await ERC20WithFees.callStatic.balanceOfWithFee(sender.address)
			let fee = balanceAndFee.sub(balance)

			expect(balance).to.equal(BigNumber.from(0))
			expect(fee).to.equal(BigNumber.from(0))


			let receiverBalance = await ERC20WithFees.callStatic.balanceOf(receiver.address)
			let receiverFee = balanceAndFee.sub(balance)

			expect(receiverBalance.toNumber()).to.be.closeTo(balanceBefore.toNumber(), 10)
			expect(receiverFee).to.equal(BigNumber.from(0))


		})
	})

	describe('Fee last paid', () => {
		it("requires amount > 0", async () => {
			const { ERC20WithFees, users, decimals } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.utils.parseUnits('0', decimals)

			await expect(sender.ERC20WithFees.transfer(receiver.address, amount)).to.be.revertedWith("ERC20: transfer amount must be greater than 0")
			let feeLastPaid = await ERC20WithFees.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(BigNumber.from(0))


		})

		it('initialised after receiving tokens', async () => {
			const { ERC20WithFees, deployer, users, decimals } = await setup()

			let user = users[0]

			const amount = ethers.utils.parseUnits('100', decimals)

			await fundFromDeployer(deployer.ERC20WithFees, user.address, amount)

			await ERC20WithFees.transfer(user.address, amount)

			const timeStamp = await time.latest()

			let feeLastPaid = await ERC20WithFees.feeLastPaid(user.address)
			expect(feeLastPaid).to.equal(BigNumber.from(timeStamp))
		})

		it('receiving tokens updates', async () => {
			const { ERC20WithFees, users, decimals } = await setup()

			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.utils.parseUnits('100', decimals)
			await fundFromDeployer(ERC20WithFees, sender.address, amount)


			await ERC20WithFees.transfer(sender.address, amount)
			let feeLastPaid = await ERC20WithFees.feeLastPaid(receiver.address)

			expect(feeLastPaid).to.equal(BigNumber.from(0))

			await expect(sender.ERC20WithFees.transfer(receiver.address, amount))
				.to.emit(ERC20WithFees, "Transfer")


			const timeStamp = await time.latest()
			feeLastPaid = await ERC20WithFees.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(BigNumber.from(timeStamp))
		})
	})

	describe('Fee collection', () => {
		it('trigger fee deduction', async () => {
			const { ERC20WithFees, minter, feeCollector, users, decimals } = await setup()

			const user = users[0]

			await fundFromDeployer(minter.ERC20WithFees, user.address, ethers.utils.parseUnits('1', decimals))

			const fee = await ERC20WithFees.feeRate()

			await timeJumpForward(365 * 24 * 60 * 60)

			await expect(user.ERC20WithFees.collectFees([user.address])).to
				.emit(ERC20WithFees, 'Transfer').withArgs(user.address, feeCollector.address, fee)
		})
		it('collects 100% fees', async () => {
			const { ERC20WithFees, minter, feeCollector, users, decimals, feeRate } = await setup()

			let necessaryTime = BigNumber.from(10 ** decimals).div(feeRate).mul(365 * 24 * 60 * 60).add(1)

			const user = users[0]
			const amount = ethers.utils.parseUnits('100', decimals)

			await fundFromDeployer(minter.ERC20WithFees, user.address, amount)

			await timeJumpForward(necessaryTime.toNumber())

			const balance = await ERC20WithFees.balanceOf(user.address)
			const balanceWithFee = await ERC20WithFees.balanceOfWithFee(user.address)

			expect(balanceWithFee).to.equal(amount)
			expect(balance).to.equal(0)


			await expect(user.ERC20WithFees.collectFees([user.address])).to
				.emit(ERC20WithFees, 'Transfer').withArgs(user.address, feeCollector.address, amount)

			const balanceAfterCollection = await ERC20WithFees.balanceOf(user.address)
			const balanceWithFeeAdterCollection = await ERC20WithFees.balanceOfWithFee(user.address)

			expect(balanceAfterCollection).to.equal(0)
			expect(balanceWithFeeAdterCollection).to.equal(0)

		})
	})


	describe('Calculate fees', () => {
		it('fees deducted from balance correctly', async () => {
			const { ERC20WithFees, minter, users, decimals } = await setup()

			const user = users[0]
			const feeRate = await ERC20WithFees.feeRate()


			expect(await ERC20WithFees.balanceOf(user.address)).to.equal(0)
			expect(await ERC20WithFees.balanceOfWithFee(user.address)).to.equal(0)

			const amount = ethers.utils.parseUnits('100', decimals)
			await fundFromDeployer(minter.ERC20WithFees, user.address, amount)

			const balanceBefore = await ERC20WithFees.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)


			const t = 365 * 24 * 60 * 60 / 2 // 1/2 year
			await timeJumpForward(t)

			const balance = await ERC20WithFees.callStatic.balanceOf(user.address)
			const balanceAndFee = await ERC20WithFees.callStatic.balanceOfWithFee(user.address)
			const fee = balanceAndFee.sub(balance)

			const expectedFee = BigNumber.from(100).mul(feeRate).div(2)

			expect(fee).to.equal(BigNumber.from(expectedFee))

		})
		it('fees from dust amounts', async () => {
			const { ERC20WithFees, minter, users, decimals } = await setup()

			const user = users[0]

			const amount = ethers.utils.parseUnits('0.00000001', decimals)

			await fundFromDeployer(minter.ERC20WithFees, user.address, amount)
			const balanceBefore = await ERC20WithFees.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(month)

			const balance = await ERC20WithFees.balanceOf(user.address)

			const balanceAndFee = await ERC20WithFees.balanceOfWithFee(user.address)

			expect(balance).to.equal(amount)
			expect(balanceAndFee).to.equal(amount)
		})

	})


	describe("Burn", () => {
		it("only by minter role", async () => {
			const { ERC20WithFees, users, decimals } = await setup()

			let user = users[0]

			const amount = ethers.utils.parseUnits('100', decimals)
			await fundFromDeployer(ERC20WithFees, user.address, amount)

			await expect(user.ERC20WithFees.burn(user.address, amount)).to.be.revertedWith("ERC20WithFees: only minter can call this function")
		})


		it("needs allowance", async () => {
			const { ERC20WithFees, users, minter, decimals } = await setup()

			const user = users[0]
			const amount = ethers.utils.parseUnits('100', decimals)
			await fundFromDeployer(ERC20WithFees, user.address, amount)

			await expect(minter.ERC20WithFees.burn(user.address, amount)).to.be.revertedWith("ERC20: insufficient allowance")
		})

		it("burns tokens", async () => {
			const { ERC20WithFees, users, minter, decimals } = await setup()

			const user = users[0]
			const amount = ethers.utils.parseUnits('100', decimals)
			await fundFromDeployer(ERC20WithFees, user.address, amount)

			await user.ERC20WithFees.approve(minter.address, amount)

			const balanceBefore = await ERC20WithFees.balanceOf(user.address)
			const supplyBefore = await ERC20WithFees.totalSupply()

			const burnAmount = ethers.utils.parseUnits('1', decimals)
			await minter.ERC20WithFees.burn(user.address, burnAmount)

			const balanceAfter = await ERC20WithFees.balanceOf(user.address)
			const supplyAfter = await ERC20WithFees.totalSupply()

			expect(balanceAfter.toNumber()).to.be.closeTo(balanceBefore.sub(burnAmount).toNumber(), 1 * 10 ** decimals)
			expect(supplyAfter).to.equal(supplyBefore.sub(burnAmount))
		})


	})


	describe("Mint", () => {
		it("only minter", async () => {
			const { users, decimals } = await setup()

			const amount = ethers.utils.parseUnits('100', decimals)

			await expect(users[0].ERC20WithFees.mint(amount)).to.be.revertedWith("ERC20WithFees: only minter can call this function")
		})

		it("mints to minter address", async () => {
			const { minter, feeCollector, decimals } = await setup()


			const amount = ethers.utils.parseUnits('100', decimals)

			const supplyBefore = await minter.ERC20WithFees.totalSupply()
			const balanceBefore = await feeCollector.ERC20WithFees.balanceOf(minter.address)

			await minter.ERC20WithFees.mint(amount)

			const supplyAfter = await minter.ERC20WithFees.totalSupply()
			const balanceAfter = await feeCollector.ERC20WithFees.balanceOf(minter.address)

			expect(supplyAfter).to.equal(supplyBefore.add(amount))
			expect(balanceAfter).to.equal(balanceBefore.add(amount))
		})
	})

	describe("Fee exemption", () => {
		it("exempt addresses do not pay fees", async () => {
			const { ERC20WithFees, feeCollector, decimals } = await setup()

			const balanceBefore = await ERC20WithFees.balanceOf(feeCollector.address)
			const balanceWithFeeBefore = await ERC20WithFees.balanceOfWithFee(feeCollector.address)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(month * 1000)

			const balanceAfter = await ERC20WithFees.balanceOf(feeCollector.address)
			const balanceWithFeeAfter = await ERC20WithFees.balanceOfWithFee(feeCollector.address)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)

		})
	})


	describe("set new fee collection address", () => {
		it("only owner", async () => {
			const { users } = await setup()

			const user = users[0]

			await expect(user.ERC20WithFees.setFeeCollectionAddress(user.address)).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("Cannot be zero address", async () => {
			const { ERC20WithFees } = await setup()
			await expect(ERC20WithFees.setFeeCollectionAddress(ethers.constants.AddressZero)).to.be.revertedWith("ERC20WithFees: collection address cannot be zero")
		})

		it("Set new fee collector", async () => {
			const { ERC20WithFees, users, deployer, feeCollector } = await setup()


			const user = users[0]
			await expect(deployer.ERC20WithFees.setFeeCollectionAddress(user.address)).to.not.be.reverted

			const lastPaid = await ERC20WithFees.feeLastPaid(feeCollector.address)
			const latestBlockTime = await time.latest()

			expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe("Set new minter address", () => {
		it("only owner", async () => {
			const { users } = await setup()

			const user = users[0]

			await expect(user.ERC20WithFees.setMinterRole(user.address)).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("cannot be zero address", async () => {
			const { ERC20WithFees } = await setup()
			await expect(ERC20WithFees.setMinterRole(ethers.constants.AddressZero)).to.be.revertedWith("ERC20WithFees: collection address cannot be zero")
		})

		it("set up new minter role", async () => {
			const { ERC20WithFees, users, deployer, minter } = await setup()


			const user = users[0]
			await expect(deployer.ERC20WithFees.setMinterRole(user.address)).to.not.be.reverted

			const lastPaid = await ERC20WithFees.feeLastPaid(minter.address)
			const latestBlockTime = await time.latest()

			expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe("Set new fee rate", () => {
		it("Only owner", async () => {
			const { ERC20WithFees, users, deployer } = await setup()

			let user = users[0]

			await expect(user.ERC20WithFees.setFeeRate(ethers.utils.parseUnits('1', 8))).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("Cannot be more than max", async () => {
			const { ERC20WithFees, users, deployer } = await setup()

			let max = await ERC20WithFees.maxFee()
			let feeLastChanged = await ERC20WithFees.lastFeeChange()
			await expect(ERC20WithFees.setFeeRate(max.add(1))).to.be.revertedWith("ERC20WithFees: fee cannot be more than max fee")
			let feeLastChangedAfter = await ERC20WithFees.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it("delay ", async () => {
			const { ERC20WithFees, users, deployer } = await setup()

			const fee = await ERC20WithFees.feeRate()

			let feeLastChanged = await ERC20WithFees.lastFeeChange()

			await expect(deployer.ERC20WithFees.setFeeRate(fee.add(1))).to.be.revertedWith("ERC20WithFees: fee change delay not passed")

			let feeLastChangedAfter = await ERC20WithFees.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it("Set new fee rate", async () => {
			const { ERC20WithFees, deployer } = await setup()

			let delay = await ERC20WithFees.feeChangeMinDelay()

			const fee = await ERC20WithFees.feeRate()

			let latestBlockTime = await time.latest()
			let travelTo = BigNumber.from(latestBlockTime).add(delay)

			await time.increaseTo(travelTo)

			await expect(deployer.ERC20WithFees.setFeeRate(fee.add(1))).to.not.be.reverted
			let feeLastChangedAfter = await ERC20WithFees.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo.add(1))

		})

		it("forgets outstanding debt with old fee rate", async () => {
			const { ERC20WithFees, deployer, users, decimals } = await setup()

			const user = users[0]
			await fundFromDeployer(ERC20WithFees, user.address, ethers.utils.parseUnits('1', decimals))

			await timeJumpForward(month)

			let balancBefore = await ERC20WithFees.callStatic.balanceOf(user.address)
			let balanceWithFeeBefore = await ERC20WithFees.callStatic.balanceOfWithFee(user.address)

			expect(balancBefore).to.not.be.equal(balanceWithFeeBefore)

			let delay = await ERC20WithFees.feeChangeMinDelay()
			let latestBlockTime = await time.latest()
			let travelTo = BigNumber.from(latestBlockTime).add(delay)

			await time.increaseTo(travelTo)

			const fee = await ERC20WithFees.feeRate()

			await expect(deployer.ERC20WithFees.setFeeRate(fee.add(1))).to.not.be.reverted
			let feeLastChangedAfter = await ERC20WithFees.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo.add(1))

			let balanceAfter = await ERC20WithFees.callStatic.balanceOf(user.address)
			let balanceWithFeeAfter = await ERC20WithFees.callStatic.balanceOfWithFee(user.address)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe("Oracle", () => {
		it("initially set as zero address", async () => {
			const { ERC20WithFees } = await setup()

			const oracle = await ERC20WithFees.oracle()
			expect(oracle).to.equal(ethers.constants.AddressZero)
		})

		it("cannot be zero address", async () => {
			const { ERC20WithFees } = await setup()
			await expect(ERC20WithFees.setOracleAddress(ethers.constants.AddressZero)).to.be.revertedWith("ERC20WithFees: oracle address cannot be zero")
		})

		it("only owner", async () => {
			const { users } = await setup()

			const user = users[0]

			await expect(user.ERC20WithFees.setOracleAddress(user.address)).to.be.revertedWith("Ownable: caller is not the owner")
		})

		it("can be changed", async () => {
			const { ERC20WithFees, users } = await setup()

			const user = users[0]

			await expect(ERC20WithFees.setOracleAddress(user.address)).to.emit(ERC20WithFees, "OracleAddressChanged").withArgs(user.address)
		})

		it("limits token minting if set", async () => {
			const { ERC20WithFees, Oracle } = await setup()

			await ERC20WithFees.setOracleAddress(Oracle.address)

			const max = await Oracle.lockedValue()

			await (expect(ERC20WithFees.mint(max.add(1))).to.be.revertedWith("ERC20WithFees: new total supply amount would exceed reserve balance"));
		})
	})
})