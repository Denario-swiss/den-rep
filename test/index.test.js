const { ethers, waffle } = require('hardhat');
const { BigNumber } = require("@ethersproject/bignumber");

const chai = require('chai');

chai.use(waffle.solidity);

const { expect, assert } = chai;
const { fastForward, currentTime } = require("./utils")();



describe('ERC20TokenWithFees', async () => {
  let owner;
  let feeCollector;
  let user, otherUser;

  let ERC20TokenWithFees;

  let contract;

  const DECIMALS = 18;
  const FEE_GRACE_PERIOD = 60 * 60 * 24;
  const FEE_RATE = 1

  const AMOUNT = hre.ethers.utils.parseUnits('100', 18)


  before(async () => {
    [
      owner,
      feeCollector,
      user,
      otherUser
    ] = await ethers.getSigners();

    ERC20TokenWithFees = await ethers.getContractFactory('ERC20TokenWithFees');

  });

  beforeEach(async () => {

    contract = await ERC20TokenWithFees.deploy('SILVER_BACKED', 'SILVER_BACKED', DECIMALS, FEE_RATE, FEE_GRACE_PERIOD, feeCollector.address);

    await contract.mint(owner.address, ethers.utils.parseUnits('100000000000', DECIMALS));

  });


  describe('Constructor', () => {
    it('Should set feeCollector', async () => {
      assert.equal(await contract.feeCollector(), feeCollector.address);
    });
    it('Should have fee grace period set', async () => {
      let gracePeriod = await contract.feeGracePeriod()
      expect(gracePeriod).to.equal(BigNumber.from(FEE_GRACE_PERIOD));
    });
    it('Should not fee rate set', async () => {
      let feeRate = await contract.feeRate()
      expect(feeRate).to.equal(BigNumber.from(FEE_RATE));
    });
    it('User should not have fees yet', async () => {
      let fee = await contract.feeLastPaid(user.address)
      expect(fee).to.equal(BigNumber.from(0));
    });
  });

  describe('Fee last paid', () => {
    it('Initialised after receiving tokens', async () => {
      let res = await contract.transfer(user.address, AMOUNT)
      const timeStamp = (await ethers.provider.getBlock(res.blockHash)).timestamp
      let feeLastPaid = await contract.feeLastPaid(user.address)
      expect(feeLastPaid).to.equal(BigNumber.from(timeStamp));
      let balance = await contract.balanceOf(user.address)
      expect(balance).to.equal(BigNumber.from(AMOUNT));

    });

    it('Updates after sending tokens', async () => {

      await contract.transfer(user.address, AMOUNT)
      let res = await contract.connect(user).transfer(otherUser.address, AMOUNT)

      const timeStamp = (await ethers.provider.getBlock(res.blockHash)).timestamp
      let feeLastPaid = await contract.feeLastPaid(user.address)
      expect(feeLastPaid).to.equal(BigNumber.from(timeStamp));

      assert.ok(feeLastPaid.gt(BigNumber.from(0)));
      let zeroBalance = await contract.balanceOf(user.address)
      expect(zeroBalance).to.equal(BigNumber.from(0));

    });
  });

  describe('Calculate Fees', () => {
    it('0 if feeLastPaid is not initialised', async () => {

      let fee = await contract.calculateFee(user.address)
      expect(fee).to.equal(BigNumber.from(BigNumber.from(0)));
    });


    it('Updates after sending tokens', async () => {

      let res = await contract.transfer(user.address, AMOUNT)
      const timeStamp = (await ethers.provider.getBlock(res.blockHash)).timestamp

      await fastForward(FEE_GRACE_PERIOD + 1)

      let fee = await contract.calculateFee(user.address)
      let val = BigNumber.from(1).mul(BigNumber.from(AMOUNT)).div(BigNumber.from(100));

      expect(fee).to.equal(val);

    });

  });


  describe('Collect fees', () => {
    it('Can not collect before lastFeePaidInitialised', async () => {
      await expect(contract.connect(feeCollector).collectFees(user.address)).to.be.revertedWith("Not holding")

    });
    it('Can not collect before gracePeriodEnds', async () => {
      await contract.transfer(user.address, AMOUNT)

      await expect(contract.connect(feeCollector).collectFees(user.address)).to.be.revertedWith("Can not collect yet")

    });

    it('Can collect after gracePeriodEnds', async () => {
      await contract.transfer(user.address, AMOUNT)

      await fastForward(FEE_GRACE_PERIOD + 1)

      await expect(contract.connect(feeCollector).collectFees(user.address)).to
        .emit(contract, 'FeeCollected')

    });
  });
}) 
