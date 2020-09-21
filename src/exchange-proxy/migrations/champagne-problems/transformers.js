'use strict'
const _ = require('lodash');
const assert = require('assert');
const {
    deployTransformer,
    deployEcosystemContract,
    enterSenderContext,
    ETH,
    NULL_ADDRESS,
    ADDRESSES_BY_CHAIN,
    SEND_OPTS,
    verifyQueuedSources,
} = require('../../../util');

const TRANSFORMER_DEPLOYER_AUTHORITIES = [
    '0x2621ea417659Ad69bAE66af05ebE5788E533E5e7',
    '0x7EF7775C0496128Cf04361E8EF679ef0e40CEeb1'
];

(async () => {
    await enterSenderContext(async ({chainId, sender}) => {
        const chainAddresses = ADDRESSES_BY_CHAIN[chainId];
        // Deploy the bridge adapter.
        const { contract: bridgeAdapter } = await deployEcosystemContract(
            'zero-ex/BridgeAdapter',
            chainAddresses.bridgeAdapterAddresses,
        )
        // Deploy the transformer deployer.
        const { contract: transformerDeployer } = await deployEcosystemContract(
            'zero-ex/TransformerDeployer',
            [...TRANSFORMER_DEPLOYER_AUTHORITIES, sender],
        );
        // Deploy the transformers.
        const transformers = {
            weth: await deployTransformer(
                transformerDeployer,
                'WethTransformer',
                chainAddresses.weth,
            ),
            payTaker: await deployTransformer(
                transformerDeployer,
                'PayTakerTransformer',
            ),
            affiliateFee: await deployTransformer(
                transformerDeployer,
                'AffiliateFeeTransformer',
            ),
            fillQuote: await deployTransformer(
                transformerDeployer,
                'FillQuoteTransformer',
                chainAddresses.exchange,
                bridgeAdapter.address,
            ),
        };
        console.log(`removing sender (${sender}) from deployer authorities`);
        await transformerDeployer.removeAuthorizedAddress(sender).send(SEND_OPTS);
        // Assert final authorities on transformer deployer.
        assert(_.isEqual(
            await transformerDeployer.getAuthorizedAddresses().call(),
            TRANSFORMER_DEPLOYER_AUTHORITIES,
        ));
    });
    await verifyQueuedSources();
})();
