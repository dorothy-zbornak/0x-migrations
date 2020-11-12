'use strict'
const _ = require('lodash');
const assert = require('assert');
const process = require('process');
const {
    addToVerifyQueue,
    createEcosystemContract,
    deployTransformer,
    deployEcosystemContract,
    encodeGovernorCalls,
    enterSenderContext,
    ETH,
    NULL_ADDRESS,
    SIMULATED,
    ADDRESSES_BY_CHAIN,
    verifyQueuedSources,
} = require('../../../util');

const DEPRECATED_FNS = [
    '0x29b02306',
];

(async () => {
    await enterSenderContext(async ({chainId, sendOpts}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        // Deploy the Uniswap feature.
        const uniswapFeature = await deployEcosystemContract(
            'zero-ex/UniswapFeature',
            chainAddresses.weth,
            chainAddresses.allowanceTarget,
        );
        // Deploy the MetaTransactions feature.
        const mtxFeature = await deployEcosystemContract(
            'zero-ex/MetaTransactionsFeature',
            chainAddresses.exchangeProxy,
        );
        const governor = createEcosystemContract(
            'multisig/ZeroExGovernor',
            chainAddresses.exchangeProxyGovernor,
        );
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );
        // Create the governor call.
        const governorCallData = encodeGovernorCalls([
            // Migrate Uniswap
            {
                to: zeroEx.address,
                value: 0,
                data: await zeroEx
                    .migrate(
                        uniswapFeature.address,
                        await uniswapFeature.migrate().encode(),
                        governor.address,
                    ).encode(),
            },
            // Migrate MetaTransactions
            {
                to: zeroEx.address,
                value: 0,
                data: await zeroEx
                    .migrate(
                        mtxFeature.address,
                        await mtxFeature.migrate().encode(),
                        governor.address,
                    ).encode(),
            },
            // Deregister the old `_transformERC20()` function.
            ...await Promise.all(DEPRECATED_FNS.map(async selector => ({
                    to: zeroEx.address,
                    value: 0,
                    data: await zeroEx
                        .extend('0x29b02306', NULL_ADDRESS)
                        .encode(),
                }),
            )),
        ]);
        console.info(`governor migrate calldata: ${governorCallData.bold.green}`);
        if (SIMULATED) {
            const signers = await governor.getOwners().call();
            // Migrate using unlocked accounts.
            const callOpts = { ...sendOpts, from: signers[0], key: undefined };
            const submitCall = governor.submitTransaction(governor.address, 0, governorCallData);
            const txId = await submitCall.call(callOpts);
            await submitCall.send(callOpts);
            console.info(`submitted governor txId: ${txId}`);
            await governor.confirmTransaction(txId).send({ ...callOpts, from: signers[1] });
            const r = await governor.executeTransaction(txId).send(callOpts);
            // Ensure migrations were successful.
            const migratedEvents = r.events.filter(e => e.name === 'Migrated');
            assert(migratedEvents.length == 2);
            console.info(`☑ Successful migration`.bold.green);
            // Ensure owner of the exchange proxy is still the governor.
            const owner = await zeroEx.owner().call();
            assert(owner.toLowerCase() === governor.address.toLowerCase());
            console.log('☑ Owner is still governor'.bold.green);
            // Ensure all deprecated functions are deregistered.
            for (const selector of DEPRECATED_FNS) {
                const impl = await zeroEx.getFunctionImplementation(selector).call();
                assert.equal(impl, NULL_ADDRESS);
            }
            console.log('☑ Deprecated functions deregistered'.bold.green);
        }
    });
    await verifyQueuedSources();
})()
    .catch(err => { console.error(err); process.exit(1) })
    .then(() => process.exit());
