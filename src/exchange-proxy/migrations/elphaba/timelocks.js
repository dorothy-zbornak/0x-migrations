'use strict'
const _ = require('lodash');
const assert = require('assert');
const process = require('process');
const {
    createEcosystemContract,
    deployEcosystemContract,
    encodeGovernorCalls,
    enterSenderContext,
    ETH,
    NULL_ADDRESS,
    SIMULATED,
    SEND_OPTS,
    ADDRESSES_BY_CHAIN,
} = require('../../../util');

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        const governor = createEcosystemContract(
            'multisig/ZeroExGovernor',
            chainAddresses.exchangeProxyGovernor,
        );
        const allowanceTarget = createEcosystemContract(
            'zero-ex/AllowanceTarget',
            chainAddresses.allowanceTarget,
        );
        const zeroEx = createEcosystemContract(
            'zero-ex/IZeroEx',
            chainAddresses.exchangeProxy,
        );
        async function createAddZeroTimelockData(contract, fnName, ...args) {
            return {
                to: governor.address,
                value: 0,
                data: await governor
                    .registerFunctionCall(
                        true,
                        (await contract[fnName](...args).encode()).slice(0, 10),
                        contract.address,
                        0,
                    ).encode(),
            };
        }
        // Create the governor call.
        const governorCallData = encodeGovernorCalls([
            // No timelock for `ZeroEx.rollback()`
            await createAddZeroTimelockData(
                zeroEx,
                'rollback',
                '0x12345678',
                NULL_ADDRESS,
            ),
            // No timelock for `AllowanceTarget.removeAuthorizedAddress()`
            await createAddZeroTimelockData(
                allowanceTarget,
                'removeAuthorizedAddress',
                NULL_ADDRESS,
            ),
            // No timelock for `AllowanceTarget.removeAuthorizedAddressAtIndex()`
            await createAddZeroTimelockData(
                allowanceTarget,
                'removeAuthorizedAddressAtIndex',
                NULL_ADDRESS,
                0,
            ),
            // Set the default timelock.
            {
                to: governor.address,
                value: 0,
                data: await governor.changeTimeLock(ONE_DAY_IN_SECONDS).encode(),
            },
        ]);
        console.info(`governor migrate calldata: ${governorCallData.bold.green}`);

        if (SIMULATED) {
            const signers = await governor.getOwners().call();
            const callOpts = { ...SEND_OPTS, from: signers[0], key: undefined };
            const submitCall = governor.submitTransaction(governor.address, 0, governorCallData);
            const txId = await submitCall.call(callOpts);
            await submitCall.send(callOpts);
            console.info(`submitted governor txId: ${txId}`);
            await governor.confirmTransaction(txId).send({ ...callOpts, from: signers[1] });
            const r = await governor.executeTransaction(txId).send(callOpts);

            async function getCustomTimeLock(contract, fn, ...args) {
                const selector = (await contract[fn](...args).encode()).slice(0, 10);
                const { hasCustomTimeLock, secondsTimeLocked } =
                    await governor.functionCallTimeLocks(selector, contract.address).call();
                assert.ok(hasCustomTimeLock);
                return parseInt(secondsTimeLocked);
            }

            // Ensure the default timelock is set.
            assert.equal(parseInt(await governor.secondsTimeLocked().call()), ONE_DAY_IN_SECONDS);
            // Ensure `zeroEx.rollback()` has a custom timelock of 0.
            assert.equal(await getCustomTimeLock(zeroEx, 'rollback', '0x12345678', NULL_ADDRESS), 0);
            // Ensure `allowanceTarget.removeAuthorizedAddress()` has a custom timelock of 0.
            assert.equal(await getCustomTimeLock(allowanceTarget, 'removeAuthorizedAddress', NULL_ADDRESS), 0);
            // Ensure `allowanceTarget.removeAuthorizedAddressAtIndex()` has a custom timelock of 0.
            assert.equal(await getCustomTimeLock(allowanceTarget, 'removeAuthorizedAddressAtIndex', NULL_ADDRESS, 0), 0);
        }
    });
})()
    .catch(err => { console.error(err); process.exit(1) })
    .then(() => process.exit());
