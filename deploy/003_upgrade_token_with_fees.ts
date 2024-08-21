import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { DSC } from '../typechain-types';
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, ethers } = hre;
	const { deploy } = deployments;

	const { deployer, proxy01Owner } = await getNamedAccounts();

	





	const upgradeResult = await deploy('DSC', {
		contract: 'DSCV2',
		from: deployer,
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
		proxy: {
			proxyContract: 'UUPS',
		
		  },
	});

	if (upgradeResult.newlyDeployed) {
		console.log(`DSCV2 deployed at ${upgradeResult.address}`);
	}


};

export default func;
func.tags = ['DSCV2'];
