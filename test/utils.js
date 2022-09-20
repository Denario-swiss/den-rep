

const hardhat = require('hardhat');

const BN = require('bn.js');

module.exports = ({ web3 } = {}) => {


    // allow non-buidler based test tasks to pass thru web3
    web3 = web3 || hardhat.web3;



    const fastForward = async seconds => {
        // It's handy to be able to be able to pass big numbers in as we can just
        // query them from the contract, then send them back. If not changed to
        // a number, this causes much larger fast forwards than expected without error.
        if (BN.isBN(seconds)) seconds = seconds.toNumber();

        // And same with strings.
        if (typeof seconds === 'string') seconds = parseFloat(seconds);

        let params = {
            method: 'evm_increaseTime',
            params: [seconds],
        };

        if (hardhat.ovm) {
            params = {
                method: 'evm_setNextBlockTimestamp',
                params: [(await currentTime()) + seconds],
            };
        }

        await send(params);

        await mineBlock();
    };

    const send = payload => {
        if (!payload.jsonrpc) payload.jsonrpc = '2.0';
        if (!payload.id) payload.id = new Date().getTime();

        return new Promise((resolve, reject) => {
            web3.currentProvider.send(payload, (error, result) => {
                if (error) return reject(error);

                return resolve(result);
            });
        });
    };


    const mineBlock = () => send({ method: 'evm_mine' });

    /**
     *  Gets the time of the last block.
     */
    const currentTime = async () => {
        const { timestamp } = await web3.eth.getBlock('latest');
        return timestamp;
    };

    return {
        fastForward,
        currentTime,
    };
};
