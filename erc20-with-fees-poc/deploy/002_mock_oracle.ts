import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { config } from 'dotenv';
import { BigNumber } from 'ethers';
config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();


    const deployResult = await deploy('MockOracle', {
        from: deployer,
        args: [],
        log: true,
        autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
        contract: "MockOracle"
    });

    if (deployResult.newlyDeployed) {
        console.log(
            `MockOracle deployed at ${deployResult.address}`
        );
    }

};

export default func;
func.tags = ['MockOracle'];
