import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, ignition } from "hardhat";
import DSCModule from "../ignition/modules/ProxyModule";
import OracleModule from "../ignition/modules/OracleModule";
import {Proxy, DSC, DSC__factory, MockOracle, MockOracle__factory } from '../typechain-types';
import { BigNumberish, ZeroAddress } from "ethers";


const SUPPLY = ethers.parseUnits('1000000', 8)
const MONTH = 30 * 24 * 60 * 60
const YEAR = 365 * 24 * 60 * 60


const fundFromDeployer = async (
	contract: DSC,
	address: string,
	amount: bigint,
) => {
	await contract.transfer(address, amount)
}

const timeJumpForward = async (timestamp: BigNumberish) => {
	const latestBlockTime = await time.latest()

	const travelTo = BigInt(latestBlockTime)+ BigInt(timestamp)
	await time.increaseTo(travelTo)
}

const setup = async () => {
	const [owner, ...users] = await ethers.getSigners();

	const { instance, proxy } = await ignition.deploy(DSCModule, {
		parameters: {
			DSCModule: {
		  },
		},
	  });

	const {oracle} = await ignition.deploy(OracleModule, {
		parameters: {
			OracleModule: {
		  },
		},
	  });


	const dsc: DSC = DSC__factory.connect(await instance.getAddress(), owner);

	const feeRate = await dsc.feeRate()
	const decimals = await dsc.decimals()

	await dsc.mint(SUPPLY)

	const oracleInstance: MockOracle = MockOracle__factory.connect(await oracle.getAddress(), owner);


	return {
		DSC: dsc,
		proxy: proxy,
		instance: instance,
		feeRate: feeRate,
		owner: owner,
		users: users,
		decimals: decimals,
		minter: owner,
		feeCollector: owner,
		Oracle: oracleInstance,
	}
}

describe('DSC', () => {
	describe('Deployment', () => {
		it('shown correct deployment data', async () => {
			const { instance } = await setup()

			const name = await instance.name()
			const symbol = await instance.symbol()
			const decimals = await instance.decimals()
			const totalSupply = await instance.totalSupply()
		
			expect(name).to.equal('Denario Silver Coin')
			expect(symbol).to.equal('DSC')
			expect(decimals).to.equal(8)
			expect(totalSupply).to.equal(SUPPLY)
		})
	})
	describe('Balance', () => {
		it('shows correct balance', async () => {
			const { DSC, users, decimals, feeRate } = await setup()


			const user = users[1]

			const amount = ethers.parseUnits('1', decimals)
			await fundFromDeployer(DSC, user.address, amount)

			let balanceBefore = await DSC.balanceOf(user.address)
			let balanceBeforeWithFees = await DSC.balanceOfWithFee(
				user.address,
			)

			expect(balanceBefore).to.equal(amount)
			expect(balanceBeforeWithFees).to.equal(amount)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(YEAR)

			const balanceAfter = await DSC.balanceOf(user.address)
			const balanceWithFeesAfter = await DSC.balanceOfWithFee(user.address)


			let expectedFee = BigInt(amount) * BigInt(feeRate) / BigInt(10 ** Number(decimals))

		

			expect(balanceAfter).to.equal(balanceBefore - expectedFee)
			expect(balanceWithFeesAfter).to.equal(amount)

		})

		it('shows correct balance: dust', async () => {
			const { DSC, users, decimals } = await setup()
			const user = users[6]

			const amount = ethers.parseUnits('0.00000001', decimals)
			await fundFromDeployer(DSC, user.address, amount)

			await timeJumpForward(101 * 365 * 24 * 60 * 60)

			const balance = await DSC.balanceOf(user.address)
			const balanceWithFees = await DSC.balanceOfWithFee(
				user.address,
			)

			expect(balance).to.equal(0)
			expect(balanceWithFees).to.equal(amount)
		})
	})

	describe('Transfer', () => {
		it('always possible to transfer all tokens', async () => {
			const { DSC,  users, decimals } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits('100', decimals)
			await fundFromDeployer(
				DSC,
				sender.address,
				amount,
			)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await DSC.balanceOf.staticCall(
				sender.address,
			)

			await DSC.connect(sender).transferAll(receiver.address)

			let balance = await DSC.balanceOf.staticCall(
				sender.address,
			)
			let balanceAndFee = await DSC.balanceOfWithFee.staticCall(
				sender.address,
			)
			let fee = balanceAndFee-balance

			expect(balance).to.equal(0)
			expect(fee).to.equal(0)

			let receiverBalance = await DSC.balanceOf.staticCall(
				receiver.address,
			)
			let receiverFee = balanceAndFee-balance

			expect(receiverBalance).to.be.closeTo(balanceBefore,10)

			expect(receiverFee).to.equal(0)
		})
		it('always possible to transfer all tokens: dust', async () => {
			const { DSC,  users } = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount: bigint = BigInt(1);
			await fundFromDeployer(
				DSC	,
				sender.address,
				amount,
			)

			await timeJumpForward(365 * 24 * 60 * 60)

			let balanceBefore = await DSC.balanceOf.staticCall(
				sender.address,
			)

			await DSC.connect(sender).transferAll(receiver.address)

			let balance = await DSC.balanceOf.staticCall(
				sender.address,
			)
			let balanceAndFee = await DSC.balanceOfWithFee.staticCall(
				sender.address,
			)
			let fee = balanceAndFee - balance

			expect(balance).to.equal(0)
			expect(fee).to.equal(0)

			let receiverBalance = await DSC.balanceOf.staticCall(
				receiver.address,
			)
			let receiverFee = balanceAndFee-balance

			expect(receiverBalance).to.be.closeTo(balanceBefore,10)
			expect(receiverFee).to.equal(0)
		})
	})

	describe('Fee last paid', () => {
		it('requires amount > 0', async () => {
			const { DSC,  users, decimals} = await setup()
			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits('0', decimals)

			await expect(
				DSC.connect(sender).transfer(receiver.address, amount),
			).to.be.revertedWith(
				'ERC20: transfer amount must be greater than 0',
			)
			let feeLastPaid = await DSC.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(0)
		})

		it('initialised after receiving tokens', async () => {
			const { DSC,  users, decimals} = await setup()

			let user = users[0]

			const amount = ethers.parseUnits('100', decimals)

			await fundFromDeployer(DSC, user.address, amount)

			await DSC.transfer(user.address, amount)

			const timeStamp = await time.latest()

			let feeLastPaid = await DSC.feeLastPaid(user.address)
			expect(feeLastPaid).to.equal(timeStamp)
		})

		it('receiving tokens updates', async () => {
			const { DSC,  users, decimals} = await setup()

			let sender = users[0]
			let receiver = users[1]

			const amount = ethers.parseUnits('100', decimals)
			await fundFromDeployer(DSC, sender.address, amount)

			await DSC.transfer(sender.address, amount)
			let feeLastPaid = await DSC.feeLastPaid(receiver.address)

			expect(feeLastPaid).to.equal(0)


			await DSC.connect(sender).transfer(receiver.address, amount)
			
			const timeStamp = await time.latest()
			feeLastPaid = await DSC.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(timeStamp)
		})
	})

	describe('Fee collection', () => {
		it('trigger fee deduction', async () => {
			const { DSC,  users, decimals} = await setup()
			const user = users[0]

			await fundFromDeployer(
				DSC,
				user.address,
				ethers.parseUnits('1', decimals),
			)

			const fee = await DSC.feeRate()

			await timeJumpForward(365 * 24 * 60 * 60)

			await DSC.connect(user).collectFees([user.address])			
		})
		it('collects 100% fees', async () => {
			const { DSC,   users, decimals, feeRate} = await setup()

			let necessaryTime = BigInt(10 ** Number(decimals)) / feeRate * BigInt(365 * 24 * 60 * 60) + BigInt(1)

			const user = users[0]
			const amount = ethers.parseUnits('100', decimals)

			await fundFromDeployer(DSC, user.address, amount)

			await timeJumpForward(necessaryTime)

			const balance = await DSC.balanceOf(user.address)
			const balanceWithFee = await DSC.balanceOfWithFee(user.address)

			expect(balanceWithFee).to.equal(amount)
			expect(balance).to.equal(0)

			await expect(DSC.connect(user).collectFees([user.address]))
			
			const balanceAfterCollection = await DSC.balanceOf(
				user.address,
			)
			const balanceWithFeeAdterCollection = await DSC.balanceOfWithFee(user.address)

			expect(balanceAfterCollection).to.equal(0)
			expect(balanceWithFeeAdterCollection).to.equal(0)
		})
	})

	describe('Calculate fees', () => {
		it('fees deducted from balance correctly', async () => {
			const { DSC,   users, decimals, feeRate} = await setup()

			const user = users[0]

			expect(await DSC.balanceOf(user.address)).to.equal(0)
			expect(await DSC.balanceOfWithFee(user.address)).to.equal(
				0,
			)

			const amount = ethers.parseUnits('100', decimals)
			await fundFromDeployer(DSC, user.address, amount)

			const balanceBefore = await DSC.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			const t = (365 * 24 * 60 * 60) / 2 // 1/2 year
			await timeJumpForward(t)

			const balance = await DSC.balanceOf.staticCall(
				user.address,
			)
			const balanceAndFee = await DSC.balanceOfWithFee.staticCall(user.address)
			const fee = balanceAndFee-balance

			const expectedFee = BigInt(100)*(feeRate)/BigInt(2)

			expect(fee).to.equal(expectedFee)
		})
		it('fees from dust amounts', async () => {
			const { DSC, users, decimals} = await setup()

			const user = users[0]

			const amount = ethers.parseUnits('0.00000001', decimals)

			await fundFromDeployer(DSC, user.address, amount)
			const balanceBefore = await DSC.balanceOf(user.address)

			expect(balanceBefore).to.equal(amount)

			await timeJumpForward(MONTH)

			const balance = await DSC.balanceOf(user.address)

			const balanceAndFee = await DSC.balanceOfWithFee(user.address)

			expect(balance).to.equal(amount)
			expect(balanceAndFee).to.equal(amount)
		})
	})

	describe('Burn', () => {
		it('only by minter role', async () => {
			const { DSC, users, decimals} = await setup()

			let user = users[0]

			const amount = ethers.parseUnits('100', decimals)
			await fundFromDeployer(DSC, user.address, amount)

			await expect(
				DSC.connect(user).burn(user.address, amount),
			).to.be.revertedWith(
				'ERC20WithFees: only minter can call this function',
			)
		})

		it('needs allowance', async () => {
			const { DSC, users, decimals} = await setup()

			const user = users[0]
			const amount = ethers.parseUnits('100', decimals)
			await fundFromDeployer(DSC, user.address, amount)

			await expect(DSC.burn(user.address, amount),).to.be.revertedWith('ERC20: insufficient allowance')})

		it('burns tokens', async () => {
			const { DSC, minter,users, decimals} = await setup()

			const user = users[0]
			const amount = ethers.parseUnits('100', decimals)
			await fundFromDeployer(DSC, user.address, amount)

			await DSC.connect(user).approve(minter.address, amount)

			const balanceBefore = await DSC.balanceOf(user.address)
			const supplyBefore = await DSC.totalSupply()

			const burnAmount = ethers.parseUnits('1', decimals)
			await DSC.burn(user.address, burnAmount)

			const balanceAfter = await DSC.balanceOf(user.address)
			const supplyAfter = await DSC.totalSupply()

			expect(balanceAfter).to.be.closeTo(balanceBefore-burnAmount,BigInt(1 * 10 ** Number(decimals)))
			expect(supplyAfter).to.equal(supplyBefore-burnAmount)
		})
	})

	describe('Mint', () => {
		it('only minter', async () => {
			const { DSC, users, decimals} = await setup()

			const amount = ethers.parseUnits('100', decimals)

			await expect(
				DSC.connect(users[0]).mint(amount),
			).to.be.revertedWith(
				'ERC20WithFees: only minter can call this function',
			)
		})

		it('mints to minter address', async () => {
			const { DSC, minter, decimals} = await setup()

			const amount = ethers.parseUnits('100', decimals)

			const supplyBefore = await DSC.totalSupply()
			const balanceBefore = await DSC.balanceOf(minter.address)

			await DSC.mint(amount)

			const supplyAfter = await DSC.totalSupply()
			const balanceAfter = await DSC.balanceOf(minter.address)

			expect(supplyAfter).to.equal(supplyBefore+amount)
			expect(balanceAfter).to.equal(balanceBefore+amount)
		})
	})

	describe('Fee exemption', () => {
		it('exempt addresses do not pay fees', async () => {
			const { DSC, feeCollector} = await setup()

			const balanceBefore = await DSC.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeBefore = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(MONTH * 1000)

			const balanceAfter = await DSC.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeAfter = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe('set new fee collection address', () => {
		it('only owner', async () => {
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(
				DSC.connect(user).setFeeCollectionAddress(user.address),
			).to.be.reverted
		})

		it('Cannot be zero address', async () => {
			const { DSC } = await setup()
			await expect(
				DSC.setFeeCollectionAddress(
					ZeroAddress
				),
			).to.be.revertedWith(
				'ERC20WithFees: collection address cannot be zero',
			)
		})

		it('Set new fee collector', async () => {
			const { DSC, users, feeCollector } =
				await setup()

			const user = users[0]
			await expect(
				DSC.setFeeCollectionAddress(user.address),
			).to.not.be.reverted

			const lastPaid = await DSC.feeLastPaid(
				feeCollector.address,
			)
			const latestBlockTime = await time.latest()

			expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe('Set new minter address', () => {
		it('only owner', async () => {
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(DSC.connect(user).setMinterRole(user.address)).to.be
				.reverted
		})

		it('cannot be zero address', async () => {
			const { DSC } = await setup()
			await expect(
				DSC.setMinterRole(ZeroAddress),
			).to.be.revertedWith(
				'ERC20WithFees: collection address cannot be zero',
			)
		})

		it('set up new minter role', async () => {
			const { DSC, users,  minter } = await setup()

			const user = users[0]
			await expect(DSC.setMinterRole(user.address)).to
				.not.be.reverted

			const lastPaid = await DSC.feeLastPaid(minter.address)
			const latestBlockTime = await time.latest()

			expect(lastPaid).to.equal(latestBlockTime)
		})
	})

	describe('Set new fee rate', () => {
		it('Only owner', async () => {
			const { DSC, users,  } = await setup()

			let user = users[0]

			await expect(
				DSC.connect(user).setFeeRate(ethers.parseUnits('1', 8)),
			).to.be.reverted
		})

		it('Cannot be more than max', async () => {
			const { DSC  } = await setup()

			let feeLastChanged = await DSC.lastFeeChange()
			let max = await DSC.maxFee()
			await expect(
				DSC.setFeeRate(max+BigInt(1)),
			).to.be.revertedWith(
				'ERC20WithFees: fee cannot be more than max fee',
			)
			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it('delay ', async () => {
			const { DSC,  } = await setup()

			const fee = await DSC.feeRate()

			let feeLastChanged = await DSC.lastFeeChange()

			await expect(
				DSC.setFeeRate(fee+BigInt(1)),
			).to.be.revertedWith('ERC20WithFees: fee change delay not passed')

			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(feeLastChanged)
		})

		it('Set new fee rate', async () => {
			const { DSC } = await setup()

			let delay = await DSC.feeChangeMinDelay()

			const fee = await DSC.feeRate()

			let latestBlockTime = await time.latest()
			let travelTo = BigInt(latestBlockTime)+delay

			await time.increaseTo(travelTo)

			await expect(DSC.setFeeRate(fee+BigInt(1))).to.not
				.be.reverted
			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo+BigInt(1))
		})

		it('forgets outstanding debt with old fee rate', async () => {
			const { DSC,  users, decimals } = await setup()

			const user = users[0]
			await fundFromDeployer(
				DSC,
				user.address,
				ethers.parseUnits('1', decimals),
			)

			await timeJumpForward(MONTH)

			let balancBefore = await DSC.balanceOf.staticCall(
				user.address,
			)
			let balanceWithFeeBefore =
				await DSC.balanceOfWithFee.staticCall(user.address)

			expect(balancBefore).to.not.be.equal(balanceWithFeeBefore)

			let delay = await DSC.feeChangeMinDelay()
			let latestBlockTime = await time.latest()
			let travelTo = BigInt(latestBlockTime)+delay

			await time.increaseTo(travelTo)

			const fee = await DSC.feeRate()

			await expect(DSC.setFeeRate(fee+BigInt(1))).to.not
				.be.reverted
			let feeLastChangedAfter = await DSC.lastFeeChange()
			expect(feeLastChangedAfter).to.equal(travelTo+BigInt(1))

			let balanceAfter = await DSC.balanceOf.staticCall(
				user.address,
			)
			let balanceWithFeeAfter =
				await DSC.balanceOfWithFee.staticCall(user.address)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe('Oracle', () => {
		it('initially set as zero address', async () => {
			const { DSC } = await setup()

			const oracle = await DSC.oracle()
			expect(oracle).to.equal(ZeroAddress)
		})

		it('cannot be zero address', async () => {
			const { DSC } = await setup()
			await expect(
				DSC.setOracleAddress(ZeroAddress),
			).to.be.revertedWith('ERC20WithFees: oracle address cannot be zero')
		})

		it('only owner', async () => {
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(DSC.connect(user).setOracleAddress(user.address)).to
				.be.reverted
		})

		it('can be changed', async () => {
			const { DSC, users } = await setup()

			const user = users[0]
			await DSC.setOracleAddress(user.address)

			const oracle = await DSC.oracle()
			expect(oracle).to.equal(user.address)
				
		})

		it('limits token minting if set', async () => {
			const { DSC, Oracle } = await setup()

			await DSC.setOracleAddress(await Oracle.getAddress())

			const max = await Oracle.lockedValue()

			await expect(DSC.mint(max+BigInt(1))).to.be.revertedWith(
				'ERC20WithFees: new total supply amount would exceed reserve balance',
			)
		})
	})

	describe('Whitelist addresses', () => {
		it('non owner reverts', async () => {
			const { DSC, users } = await setup()

			const user = users[1]

			await expect(DSC.connect(user).setFeeExempt(user.address)).to.be
				.reverted

			await expect(DSC.connect(user).unsetFeeExempt(user.address)).to.be
				.reverted
		})

		it('owner can whitelist', async () => {
			const { DSC, users } = await setup()

			const user = users[1]

			let isExempt = await DSC.feeExempt(user.address)
			expect(isExempt).to.be.false;

			await expect(DSC.setFeeExempt(user.address)).to.not.be
				.reverted

			isExempt = await DSC.feeExempt(user.address)
			expect(isExempt).to.be.true;

			await expect(DSC.unsetFeeExempt(user.address)).to.not.be
				.reverted

			isExempt = await DSC.feeExempt(user.address)
			expect(isExempt).to.be.false;
		})

		it('exempt addresses do not pay fees', async () => {
			const { DSC, feeCollector } = await setup()

			const balanceBefore = await DSC.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeBefore = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceBefore).to.equal(balanceWithFeeBefore)

			await timeJumpForward(MONTH * 1000)

			const balanceAfter = await DSC.balanceOf(
				feeCollector.address,
			)
			const balanceWithFeeAfter = await DSC.balanceOfWithFee(
				feeCollector.address,
			)

			expect(balanceAfter).to.equal(balanceWithFeeAfter)
		})
	})

	describe('Test Upgrade', () => {
		var DSCV2Address: string
		beforeEach(async () => {
			const {  } = await setup()

			// Deploy new implementation
			const NewDSC = await ethers.getContractFactory('DSC')
			const newDSC = await NewDSC.deploy()
			await newDSC.waitForDeployment()

			console.log('New DSCV2 deployed to:', newDSC.address)

			DSCV2Address = await newDSC.getAddress()
		})

		it('Upgrade only by owner', async () => {
			const { DSC, users } = await setup()

			const user = users[0]

			await expect(DSC.connect(user).upgradeToAndCall(user.address, '0x')).to.be.reverted
		})
		it('Upgrade to new contract', async () => {
			const { DSC, owner } = await setup()

			let contractOwner = await DSC.owner()
			expect(owner).to.be.eq(contractOwner)

			await DSC.upgradeToAndCall(DSCV2Address, '0x')

			// console.log(res)
		})
	})
})
