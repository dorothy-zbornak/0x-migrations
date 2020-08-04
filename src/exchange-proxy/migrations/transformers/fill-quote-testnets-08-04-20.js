'use strict'
const assert = require('assert');
const BigNumber = require('bignumber.js');
const _ = require('lodash');
const {
    createEcosystemContract,
    encodeGovernorCalls,
    deployTransformer,
    ETH,
    NULL_ADDRESS,
    SECRETS,
    SENDER,
    SEND_OPTS,
    verifyQueuedSources,
    wait,
} = require('../../../util');

const EXCHANGE_ADDRESSES = {
    '3': '0x5d8C9Ba74607D2cbc4176882A42D4ACE891c1c00',
    '4': '0xf8becacec90bfc361c0a2c720839e08405a72f6d',
    '42': '0xF1eC7d0BA42f15fb5c9E3aDBe86431973e44764C',
};

(async () => {
    const chainId = await ETH.getChainId();
    const startingBalance = await ETH.getBalance(SENDER);
    const deployer = createEcosystemContract(
        'zero-ex/TransformerDeployer',
        SECRETS.exchangeProxyTransformerDeployer,
    );
    // TransformerDeployer is bugged. This will fail.
    // const receipt = await deployer.kill('0x9b81a08ef144e7aa4925f7fd77da1e1b3990e59a').send(SEND_OPTS);
    const deployedAddress = await deployTransformer(
        deployer,
        'FillQuoteTransformer',
        EXCHANGE_ADDRESSES[chainId],
    );
    console.log(`deployed at ${deployedAddress.green.bold}`);
    console.log(
        'cost:',
        new BigNumber(startingBalance)
            .minus(
                await ETH.getBalance(SENDER),
            )
            .div('1e18')
            .toString(10)
            .red,
    );
    await wait(20000);
    await verifyQueuedSources();
})();
