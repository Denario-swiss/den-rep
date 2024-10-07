
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

### AMOY TESTNET SILVER
### AMOY TESTNET SILVER
### AMOY TESTNET SILVER

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

### POLYGON PRODUCTION SILVER
### POLYGON PRODUCTION SILVER
### POLYGON PRODUCTION SILVER

# deploy token to polygon
deploy-polygon-dsc:
	npx hardhat ignition deploy \
		--network polygon \
		--parameters ./ignition/parameters/polygon.json \
		./ignition/modules/TokenModule.ts

# upgrade token
upgrade-polygon-dsc:
	npx hardhat ignition deploy \
		--network polygon \
		--parameters ./ignition/parameters/polygon.json \
		./ignition/modules/UpgradeModule.ts

# verify deployed contract with polygonscan
verify-polygon-dsc:
	npx hardhat ignition verify chain-137

### AMOY TESTNET GOLD
### AMOY TESTNET GOLD
### AMOY TESTNET GOLD

deploy-gold-amoy:
	npx hardhat ignition deploy \
		--network polygonAmoy \
		--parameters ./ignition/parameters/gold-amoy.json \
		./ignition/modules/GoldModule.ts

# verify deployed contract with polygonscan
verify-gold-amoy:
	npx hardhat ignition verify chain-80002

# deploy an upgraded token and assign it to the proxy on testnet
upgrade-gold-amoy:
	npx hardhat ignition deploy \
		--network polygonAmoy \
		--parameters ./ignition/parameters/gold-amoy.json \
		./ignition/modules/GoldUpgradeModule.ts

### POLYGON PRODUCTION GOLD
### POLYGON PRODUCTION GOLD
### POLYGON PRODUCTION GOLD

# deploy token to polygon
deploy-polygon-dgc:
	npx hardhat ignition deploy \
		--network polygon \
		--parameters ./ignition/parameters/gold-polygon.json \
		./ignition/modules/GoldModule.ts

# verify deployed contract with polygonscan
verify-polygon-dgc:
	npx hardhat ignition verify chain-137
