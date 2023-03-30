import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { BigNumber } from 'ethers';
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const { deployer } = await getNamedAccounts();

	// TODO read from .env
	// let args = [
	// 	process.env.DEPLOY_DATA_NAME,
	// 	process.env.DEPLOY_DATA_SYMBOL,
	// 	process.env.DEPLOY_DATA_DECIMALS,
	// 	process.env.DEPLOY_DATA_FEE_RATE,
	// 	ethers.utils.parseUnits("0.1", 18),
	// 	BigNumber.from(365 * 24 * 60 * 60),
	// 	deployer,
	// ]

	const decimals = 8

	let args = [
		"Test Inflation Token",
		"TIT",
		decimals,
		ethers.utils.parseUnits("0.01", decimals),
		ethers.utils.parseUnits("0.1", decimals),
		BigNumber.from(365 * 24 * 60 * 60),
		deployer,
		deployer,
	]


	const deployResult = await deploy('ERC20WithFees', {
		from: deployer,
		args: args,
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		contract: "ERC20WithFees"
	});

	if (deployResult.newlyDeployed) {
		console.log(
			`ERC20WithFees deployed at ${deployResult.address}`
		);
	}

};

export default func;
func.tags = ['ERC20WithFees'];
