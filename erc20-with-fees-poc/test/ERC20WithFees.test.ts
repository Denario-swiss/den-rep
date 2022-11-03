import { ethers, deployments, getUnnamedAccounts, getNamedAccounts } from 'hardhat';
import { setupUsers, setupUser } from './utils';
import { expect, assert } from './chai-setup';
import { BigNumber } from "@ethersproject/bignumber"
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ERC20WithFees } from '../typechain-types';


const totalRewardAmount = ethers.utils.parseUnits('1000000', 18)
const DECIMALS = 18;

const setup = deployments.createFixture(async () => {

	await deployments.fixture(['ERC20WithFees']);


	const contracts = {
		ERC20WithFees: <ERC20WithFees>await ethers.getContract('ERC20WithFees'),
	};

	// we get the tokenOwner
	const { deployer, feeCollector } = await getNamedAccounts();

	// Get the unnammedAccounts (which are basically all accounts not named in the config,
	// This is useful for tests as you can be sure they have noy been given tokens for example)
	// We then use the utilities function to generate user objects
	// These object allow you to write things like `users[0].Token.transfer(....)`
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	// finally we return the whole object (including the tokenOwner setup as a User object)


	return {
		...contracts,
		users,
		deployer: await setupUser(deployer, contracts),
		feeCollector: await setupUser(feeCollector, contracts),
		data: {
			name: process.env.DEPLOY_DATA_NAME,
			symbol: process.env.DEPLOY_DATA_SYMBOL,
			decimals: BigNumber.from(process.env.DEPLOY_DATA_DECIMALS),
			feeRate: BigNumber.from(process.env.DEPLOY_DATA_FEE_RATE),
			feeGracePeriod: BigNumber.from(process.env.DEPLOY_DATA_FEE_GRACE_PERIOD)
		}
	};
});

describe('StakingRewards', () => {

	describe('Constructor & Settings', () => {
		it('it should initialise fields', async () => {
			const { ERC20WithFees, feeCollector, data } = await setup();
			expect(await ERC20WithFees.name()).to.equal(data.name);
			expect(await ERC20WithFees.symbol()).to.equal(data.symbol);
			expect(await ERC20WithFees.decimals()).to.equal(data.decimals);
			expect(await ERC20WithFees.feeRate()).to.equal(data.feeRate);
			expect(await ERC20WithFees.feeGracePeriod()).to.equal(data.feeGracePeriod);
			expect(await ERC20WithFees.feeCollector()).to.equal(feeCollector.address);

			expect(await ERC20WithFees.totalSupply()).to.equal(ethers.utils.parseUnits('0', DECIMALS));

		});
	});


	describe('Fee last paid', () => {
		it('Initialised after minting', async () => {
			const { ERC20WithFees, users } = await setup();

			let user = users[0];

			const AMOUNT = ethers.utils.parseUnits('100', 18)
			await ERC20WithFees.mint(users[0].address, AMOUNT)

			const timeStamp = await time.latest()

			let feeLastPaid = await ERC20WithFees.feeLastPaid(user.address)
			expect(feeLastPaid).to.equal(BigNumber.from(timeStamp));
		});

		it('Unset after all tokens burnt', async () => {
			const { ERC20WithFees, users } = await setup();

			let user = users[0];

			const AMOUNT = ethers.utils.parseUnits('100', 18)
			await ERC20WithFees.mint(user.address, AMOUNT)

			const timeStamp = await time.latest()

			let feeLastPaid = await ERC20WithFees.feeLastPaid(user.address)

			expect(feeLastPaid).to.equal(BigNumber.from(timeStamp));

			await user.ERC20WithFees.burn(AMOUNT);

			feeLastPaid = await ERC20WithFees.feeLastPaid(user.address)

			expect(feeLastPaid).to.equal(BigNumber.from(0));
		});

		it('Receiving tokens updates', async () => {
			const { ERC20WithFees, users } = await setup();

			let sender = users[0];
			let receiver = users[1];

			const AMOUNT = ethers.utils.parseUnits('100', 18)

			await ERC20WithFees.mint(sender.address, AMOUNT)
			let feeLastPaid = await ERC20WithFees.feeLastPaid(receiver.address)

			expect(feeLastPaid).to.equal(BigNumber.from(0));

			await sender.ERC20WithFees.transfer(receiver.address, ethers.utils.parseUnits('1', 18));
			const timeStamp = await time.latest()

			feeLastPaid = await ERC20WithFees.feeLastPaid(receiver.address)
			expect(feeLastPaid).to.equal(BigNumber.from(timeStamp));
		});

		it('Transferring all assets unsets', async () => {
			const { ERC20WithFees, users } = await setup();

			let sender = users[0];
			let receiver = users[1];

			const AMOUNT = ethers.utils.parseUnits('100', 18)

			await ERC20WithFees.mint(sender.address, AMOUNT)

			await sender.ERC20WithFees.transfer(receiver.address, AMOUNT);

			let feeLastPaid = await ERC20WithFees.feeLastPaid(sender.address)
			expect(feeLastPaid).to.equal(BigNumber.from(0));
		});

	});



	describe('Force fee collection', () => {
		it('Can not collect before lastFeePaidInitialised', async () => {
			const { ERC20WithFees, feeCollector, users } = await setup();

			let user = users[0];

			await expect(feeCollector.ERC20WithFees.collectFees(user.address)).to.be.revertedWith("No balance to collect");

		});
		it('Can not collect before gracePeriodEnds', async () => {
			const { ERC20WithFees, feeCollector, users } = await setup();
			let user = users[0];

			await ERC20WithFees.mint(user.address, ethers.utils.parseUnits('100', 18))

			await expect(feeCollector.ERC20WithFees.collectFees(user.address)).to.be.revertedWith("Grace period has not ended. Cannot force fee collection yet.")

		});

		it('Can collect after gracePeriodEnds', async () => {
			const { ERC20WithFees, feeCollector, users, data } = await setup();
			let user = users[0];

			await ERC20WithFees.mint(user.address, ethers.utils.parseUnits('100', 18))

			let latestBlockTime = await time.latest();
			let afterGracePeriod = BigNumber.from(latestBlockTime).add(data.feeGracePeriod).add(1);
			await time.increaseTo(afterGracePeriod);


			await expect(feeCollector.ERC20WithFees.collectFees(user.address)).to
				.emit(ERC20WithFees, 'FeeCollected')

		});
	});


	describe('Calculate fees', () => {
		it('Fees deducted from balance correctly', async () => {
			const { ERC20WithFees, feeCollector, users, data } = await setup();

			let user = users[0];

			let AMOUNT = ethers.utils.parseUnits('100', 18)

			await (ERC20WithFees.mint(user.address, AMOUNT));
			let balanceBefore = await ERC20WithFees.balanceOf(user.address)

			expect(balanceBefore).to.equal(AMOUNT);

			let latestBlockTime = await time.latest();
			let month = 30 * 24 * 60 * 60;

			let travelTo = BigNumber.from(latestBlockTime).add(BigNumber.from(month));

			await time.increaseTo(travelTo);

			let fee = await ERC20WithFees.calculateFee(user.address);

			let expectedFee = BigNumber.from(AMOUNT).mul(data.feeRate).div(100);

			expect(fee).to.equal(BigNumber.from(expectedFee));

			let afterBalance = await ERC20WithFees.balanceOf(user.address)

			expect(afterBalance).to.equal(BigNumber.from(AMOUNT).sub(BigNumber.from(expectedFee)));
		});
		it('Fees from dust amounts', async () => {
			const { ERC20WithFees, feeCollector, users, data } = await setup();

			let user = users[0];

			let AMOUNT = ethers.utils.parseUnits('0.000000000000000001', 18)

			await (ERC20WithFees.mint(user.address, AMOUNT));
			let balanceBefore = await ERC20WithFees.balanceOf(user.address)

			expect(balanceBefore).to.equal(AMOUNT);

			let latestBlockTime = await time.latest();
			let month = 30 * 24 * 60 * 60;

			let travelTo = BigNumber.from(latestBlockTime).add(BigNumber.from(month));

			await time.increaseTo(travelTo);

			let fee = await ERC20WithFees.calculateFee(user.address);

			let expectedFee = BigNumber.from(AMOUNT).mul(data.feeRate).div(100);

			expect(fee).to.equal(BigNumber.from(expectedFee));
			let afterBalance = await ERC20WithFees.balanceOf(user.address)

			expect(afterBalance).to.equal(BigNumber.from(AMOUNT).sub(BigNumber.from(expectedFee)));
		});
		it('Dust collected as fees, resets', async () => {
			const { ERC20WithFees, feeCollector, users, data } = await setup();

			let user = users[0];

			let AMOUNT = ethers.utils.parseUnits('0.000000000000000001', 18)

			await (ERC20WithFees.mint(user.address, AMOUNT));
			let balanceBefore = await ERC20WithFees.balanceOf(user.address)

			expect(balanceBefore).to.equal(AMOUNT);

			let latestBlockTime = await time.latest();
			let month = 30 * 24 * 60 * 60;

			let travelTo = BigNumber.from(latestBlockTime).add(BigNumber.from(month * 100));

			await time.increaseTo(travelTo);

			let fee = await ERC20WithFees.calculateFee(user.address);

			let expectedFee = BigNumber.from(1)

			expect(fee).to.equal(BigNumber.from(expectedFee));
			let afterBalance = await ERC20WithFees.balanceOf(user.address)

			expect(afterBalance).to.equal(BigNumber.from(AMOUNT).sub(BigNumber.from(expectedFee)));

			await ERC20WithFees.collectFees(user.address)

			let zeroBalance = await ERC20WithFees.balanceOf(user.address)
			expect(zeroBalance).to.equal(BigNumber.from(0));

			let lastFeePaid = await ERC20WithFees.feeLastPaid(user.address)
			expect(lastFeePaid).to.equal(BigNumber.from(0));

		});
	});



});