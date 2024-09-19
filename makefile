
deploy-hardhat:
	npx hardhat ignition deploy \
		--network hardhat \
		ignition/modules/tokenModule.ts

# deploy the initial token and proxy

deploy:
	npx hardhat ignition deploy \
		--network localhost \
		--parameters ./ignition/parameters/localhost.json \
		./ignition/modules/TokenModule.ts

# deploy an upgraded token and assign it to the proxy
upgrade:
	npx hardhat ignition deploy \
		--network localhost \
		--parameters ./ignition/parameters/localhost.json \
		./ignition/modules/UpgradeModule.ts

# "deploy:amoy": "npx hardhat ignition deploy ignition/modules/ProxyModule.ts --network polygonAmoy --parameters ignition/parameters/amoy.json",
# "verify:amoy": "npx hardhat ignition verify chain-80002",
