import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { ERC20WithFees } from '../typechain-types';

config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

	const { ethers, deployments, getNamedAccounts } = hre;
	const initialSupply = process.env.DEPLOY_DATA_INITIAL_SUPPLY
	if (!initialSupply) {
		return
	}


	const { deployer } = await getNamedAccounts();


	const token = <ERC20WithFees>await ethers.getContract('ERC20WithFees')

	await token.mint(deployer, ethers.utils.parseUnits(initialSupply, 18))
	console.log(`Minted 1000 tokens to ${deployer}`)


};

export default func;
func.tags = ['mint'];
