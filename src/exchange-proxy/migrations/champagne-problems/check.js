'use strict'
const _ = require('lodash');
const assert = require('assert');
const {
    createEcosystemContract,
    deployTransformer,
    deployEcosystemContract,
    enterSenderContext,
    ETH,
    NULL_ADDRESS,
    SEND_OPTS,
    ADDRESSES_BY_CHAIN,
    verifyQueuedSources,
} = require('../../../util');

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );
        // Ensure owner of the exchange proxy is still the governor.
        const owner = await zeroEx.owner().call();
        assert(owner.toLowerCase() === chainAddresses.exchangeProxyGovernor);
        console.log('☑ owner is still governor'.bold.green);
        // Ensure the flashwallet has not changed.
        assert((await zeroEx.getTransformWallet().call()).toLowerCase() == chainAddresses.flashWallet);
        console.log('☑ Flashwallet has not changed'.bold.green);
    });
})();
