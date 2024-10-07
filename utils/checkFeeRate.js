async function main() {
	const contractName = "DSCV2"
	const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
	const myContract = await hre.ethers.getContractAt(
		contractName,
		contractAddress,
	)

	const name = await myContract.name()
	console.log("name:", name)

	const version = await myContract.version()
	console.log("version:", version)

	const feeRate = await myContract.feeRate()
	console.log("current fee rate:", feeRate.toString())

	const tx = await myContract.reduceFeeRate(0)
	await tx.wait()

	const newFeeRate = await myContract.feeRate()
	console.log("new fee rate:", newFeeRate.toString())
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
