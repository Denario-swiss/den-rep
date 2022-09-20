const ganache = require('ganache-cli');
const fs = require('fs');
const { ethers } = require('ethers');

const GANACHE_PORT = parseInt(process.env.PORT || 8545);
const INITIAL_BALANCE = ethers.utils.parseUnits('1000000000000000000000000', 'ether');

console.log(INITIAL_BALANCE.toString());



const generateAccounts = (count = 1) => {
  if (fs.existsSync('./dev/ganache-accounts')) {
    const accountsPrivateKeys = fs.readFileSync('./dev/ganache-accounts', { encoding: 'utf8' }).split(',').map((pk) => pk.trim());
    if (accountsPrivateKeys.length < count) {
      const accounts = Array(count - accountsPrivateKeys.length).fill(0).map(() => {
        const wallet = ethers.Wallet.createRandom();
        return {
          secretKey: wallet.privateKey,
          balance: INITIAL_BALANCE.toHexString(),
        };
      });
      for (let i = 0; i < accounts.length; i++) {
        accountsPrivateKeys.push(accounts[i].secretKey);
      }
      fs.writeFileSync('./dev/ganache-accounts', accountsPrivateKeys.join(','), { encoding: 'utf8' });
    }

    console.log(`accounts: ${accountsPrivateKeys.join(',')}`);
    return accountsPrivateKeys.map((pk) => ({
      secretKey: pk,
      balance: INITIAL_BALANCE.toHexString(),
    }));
  }
  const accounts = Array(count).fill(0).map(() => {
    const wallet = ethers.Wallet.createRandom();

    return {
      secretKey: wallet.privateKey,
      balance: INITIAL_BALANCE.toHexString(),
    };
  });
  fs.writeFileSync('./dev/ganache-accounts', accounts.map(({ secretKey }) => secretKey).join(','), { encoding: 'utf8' });
  return accounts;
};

const GANACHE_ACCOUNTS = generateAccounts(10);

const startGanache = () => {
  const server = ganache.server({
    accounts: GANACHE_ACCOUNTS,
    logger: console,
    port: GANACHE_PORT,
    db_path: './ganache-db',
    default_balance_ether: 100,
  });

  server.listen(GANACHE_PORT, (err, blockchain) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log('Ganache blockchain started');
  });
};
startGanache();
