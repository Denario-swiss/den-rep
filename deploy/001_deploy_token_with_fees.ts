import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { BigNumber } from 'ethers';
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const { deployer } = await getNamedAccounts();

	let args;


	if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
		if (!process.env.DEPLOY_DATA_NAME) {
			throw new Error("Missing DEPLOY_DATA_NAME env variable")
		}
		if (!process.env.DEPLOY_DATA_SYMBOL) {
			throw new Error("Missing DEPLOY_DATA_SYMBOL env variable")
		}
		if (!process.env.DEPLOY_DATA_DECIMALS) {
			throw new Error("Missing DEPLOY_DATA_DECIMALS env variable")
		}
		if (!process.env.DEPLOY_DATA_FEE_RATE) {
			throw new Error("Missing DEPLOY_DATA_FEE_RATE env variable")
		}
		if (!process.env.DEPLOY_DATA_MAX_FEE_RATE) {
			throw new Error("Missing DEPLOY_DATA_MAX_FEE_RATE env variable")
		}
		if (!process.env.DEPLOY_DATA_MAX_DELAY_FEE_CHANGE) {
			throw new Error("Missing DEPLOY_DATA_MAX_DELAY_FEE_CHANGE env variable")
		}
		if (!process.env.DEPLOY_DATA_FEE_COLLECTION_TREASURY_ADDRESS) {
			throw new Error("Missing DEPLOY_DATA_FEE_COLLECTION_TREASURY_ADDRESS env variable")
		}
		if (!process.env.DEPLOY_DATA_MINTER_ADDRESS) {
			throw new Error("Missing DEPLOY_DATA_MINTER_ADDRESS env variable")
		}
		args = [
			process.env.DEPLOY_DATA_NAME,
			process.env.DEPLOY_DATA_SYMBOL,
			process.env.DEPLOY_DATA_DECIMALS,
			ethers.utils.parseUnits(process.env.DEPLOY_DATA_FEE_RATE, 18),
			ethers.utils.parseUnits(process.env.DEPLOY_DATA_MAX_FEE_RATE, 18),
			BigNumber.from(process.env.DEPLOY_DATA_MAX_DELAY_FEE_CHANGE),
			process.env.DEPLOY_DATA_FEE_COLLECTION_TREASURY_ADDRESS,
			process.env.DEPLOY_DATA_MINTER_ADDRESS,
		]

	} else {
		const decimals = 8

		args = [
			"Test Inflation Token",
			"TIT",
			decimals,
			ethers.utils.parseUnits("0.01", decimals),
			ethers.utils.parseUnits("0.1", decimals),
			BigNumber.from(365 * 24 * 60 * 60),
			deployer,
			deployer,
		]
	}





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
