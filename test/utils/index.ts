import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import { DSC } from "../../typechain-types"
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { BigNumberish } from "ethers"

export async function setupUsers<
	T extends { [contractName: string]: Contract },
>(addresses: string[], contracts: T): Promise<({ address: string } & T)[]> {
	const users: ({ address: string } & T)[] = []
	for (const address of addresses) {
		users.push(await setupUser(address, contracts))
	}
	return users
}

export async function setupUser<T extends { [contractName: string]: Contract }>(
	address: string,
	contracts: T,
): Promise<{ address: string } & T> {
	const user: any = { address }
	const signer = await ethers.getSigner(address)
	for (const key of Object.keys(contracts)) {
		user[key] = contracts[key].connect(signer)
	}
	return user as { address: string } & T
}


export function getRandomInt(min: number, max: number): number {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function fundFromDeployer(
	contract: DSC,
	address: string,
	amount: bigint,
) {
	await contract.transfer(address, amount)
}

export async function timeJumpForward  (timestamp: BigNumberish){
	const latestBlockTime = await time.latest()

	const travelTo = BigInt(latestBlockTime) + BigInt(timestamp)
	await time.increaseTo(travelTo)
}