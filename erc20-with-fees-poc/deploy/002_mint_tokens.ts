import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { ERC20WithFees } from '../typechain-types';

config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

	const { ethers, deployments, getNamedAccounts } = hre;
	const oneKgSilver = ethers.utils.parseUnits('1000', 18)


	const token = <ERC20WithFees>await ethers.getContract('ERC20WithFees')

	let recipientWallets = process.env.DEPLOY_DATA_RECIPIENT_WALLETS_MUMBAI?.split(',') || [];

	for (let recipient of recipientWallets) {
		await token.mint(recipient, oneKgSilver)
		console.log(`Minted 1000 tokens to ${recipient}`)
	}

};

export default func;
func.tags = ['mint'];
