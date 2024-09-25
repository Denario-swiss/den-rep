
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

check:
	npm run coverage

# deploy an upgraded token and assign it to the proxy
upgrade:
	npx hardhat ignition deploy \
		--network localhost \
		--parameters ./ignition/parameters/localhost.json \
		./ignition/modules/UpgradeModule.ts

# deploy token to amoy testnet
deploy-amoy:
	npx hardhat ignition deploy \
		--network polygonAmoy \
		--parameters ./ignition/parameters/amoy.json \
		./ignition/modules/TokenModule.ts

# verify deployed contract with polygonscan
verify-amoy:
	npx hardhat ignition verify chain-80002

# deploy an upgraded token and assign it to the proxy on testnet
upgrade-amoy:
	npx hardhat ignition deploy \
		--network polygonAmoy \
		--parameters ./ignition/parameters/amoy.json \
		./ignition/modules/UpgradeModule.ts
