import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;

	const { deployer } = await getNamedAccounts();

	const deployResult = await deploy('ERC20WithFees', {
		from: deployer,
		args: [process.env.DEPLOY_DATA_NAME, process.env.DEPLOY_DATA_SYMBOL, process.env.DEPLOY_DATA_DECIMALS, process.env.DEPLOY_DATA_FEE_RATE, process.env.DEPLOY_DATA_FEE_GRACE_PERIOD, deployer],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		contract: "ERC20WithFees"
	});

	if (deployResult.newlyDeployed) {
		console.log(
			`contract Token deployed at ${deployResult.address}gas`
		);
	}
};

export default func;
func.tags = ['ERC20WithFees'];
