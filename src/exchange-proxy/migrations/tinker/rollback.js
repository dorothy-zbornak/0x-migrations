'use strict'
const _ = require('lodash');
const assert = require('assert');
const {
    createEcosystemContract,
    deployTransformer,
    deployEcosystemContract,
    encodeGovernorCalls,
    enterSenderContext,
    verifyQueuedSources,
    SIMULATED,
    SEND_OPTS,
} = require('../../../util');

const ADDRESSES_BY_CHAIN = {
    '1': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
    },
    '3': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
    },
    '4': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
    },
    '42': {
        exchangeProxyGovernor: '0x618f9c67ce7bf1a50afa1e7e0238422601b0ff6e',
        exchangeProxy: '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
    },
};

const SELECTORS_TO_ROLLBACK = [
    '0xc853c969', // _transformERC20()
    '0x415565b0', // transformERC20()
    '0xd9627aa4', // sellToUniswap()
];

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        const governor = createEcosystemContract(
            'multisig/ZeroExGovernor',
            chainAddresses.exchangeProxyGovernor,
        );
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );

        // Get the addresses for the rollback.
        const rollbackImpls = Object.assign({},
            ...await Promise.all(SELECTORS_TO_ROLLBACK.map(async selector => {
                const historyLength = await zeroEx.getRollbackLength(selector).call();
                assert(historyLength > 0);
                return {
                    [selector]: await zeroEx.getRollbackEntryAtIndex(selector, historyLength - 1).call(),
                };
            })),
        );

        console.info(rollbackImpls);

        // Create the governor call.
        const governorCallData = encodeGovernorCalls(
            await Promise.all(
                Object.entries(rollbackImpls).map(async ([selector, impl]) => ({
                    to: zeroEx.address,
                    value: 0,
                    data: await zeroEx.rollback(selector, impl).encode(),
                })),
            ),
        );
        console.info(`governor migrate calldata: ${governorCallData.bold.green}`);

        if (SIMULATED) {
            // Get the governor authorities.
            const authorities = await governor.getOwners().call();
            // Migrate using unlocked accounts.
            const callOpts = { ...SEND_OPTS, from: authorities[0], key: undefined };
            const txId = await governor.transactionCount().call();
            await governor.submitTransaction(governor.address, 0, governorCallData).send(callOpts);
            console.info(`submitted governor txId: ${txId}`);
            await governor.confirmTransaction(txId).send({ ...callOpts, from: authorities[1] });
            // Advance time to bypass timelock.
            const timeLock = await governor.secondsTimeLocked().call();
            const r = await governor.executeTransaction(txId).send(callOpts);
            // Ensure migrations were successful.
            const migratedEvents = r.events.filter(e => e.name === 'ProxyFunctionUpdated');
            assert(migratedEvents.length == 3);
            console.info(`☑ Successful rollback`.bold.green);
        }
    });
})();
