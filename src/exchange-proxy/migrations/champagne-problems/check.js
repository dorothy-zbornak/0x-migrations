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
    verifyQueuedSources,
} = require('../../../util');

const ADDRESSES_BY_CHAIN = {
    '1': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
    '3': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
    '4': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
    '42': {
        governor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
        flashWallet: '0x22f9dcf4647084d6c31b2765f6910cd85c178c18',
    },
};

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );
        // Ensure owner of the exchange proxy is still the governor.
        const owner = await zeroEx.owner().call();
        assert(owner.toLowerCase() === chainAddresses.governor);
        console.log('☑ owner is still governor'.bold.green);
        // Ensure the flashwallet has not changed.
        assert((await zeroEx.getTransformWallet().call()).toLowerCase() == chainAddresses.flashWallet);
        console.log('☑ Flashwallet has not changed'.bold.green);
    });
})();
