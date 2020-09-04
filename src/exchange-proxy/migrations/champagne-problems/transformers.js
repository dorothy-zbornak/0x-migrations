'use strict'
const _ = require('lodash');
const assert = require('assert');
const {
    deployTransformer,
    deployEcosystemContract,
    enterSenderContext,
    ETH,
    NULL_ADDRESS,
    SEND_OPTS,
    verifyQueuedSources,
} = require('../../../util');

const TRANSFORMER_DEPLOYER_AUTHORITIES = [
    '0x2621ea417659Ad69bAE66af05ebE5788E533E5e7',
    '0x7EF7775C0496128Cf04361E8EF679ef0e40CEeb1'
];

const ADDRESSES_BY_CHAIN = {
    '1': {
        weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        exchange: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
        bridgeAdapterAddresses: {
            balancerBridge: '0xfe01821Ca163844203220cd08E4f2B2FB43aE4E4',
            curveBridge: '0x1796Cd592d19E3bcd744fbB025BB61A6D8cb2c09',
            kyberBridge: '0xadd97271402590564ddd8ad23cb5317b1fb0fffb',
            mooniswapBridge: '0x02b7eca484ad960fca3f7709e0b2ac81eec3069c',
            mStableBridge: '0x2bF04fceA05F0989A14d9AFA37aa376bAca6b2b3',
            oasisBridge: '0x991C745401d5b5e469B8c3e2cb02C748f08754f1',
            uniswapBridge: '0x36691C4F426Eb8F42f150ebdE43069A31cB080AD',
            uniswapV2Bridge: '0xDcD6011f4C6B80e470D9487f5871a0Cba7C93f48',
            kyberNetworkProxy: '0x9AAb3f75489902f3a48495025729a0AF77d4b11e',
            oasis: '0x794e6e91555438aFc3ccF1c5076A74F42133d08D',
            uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            uniswapExchangeFactory: '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95',
            mStable: '0xe2f2a5C287993345a840Db3B0845fbC70f5935a5',
            weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        },
    },
    '3': {
        weth: '0xc778417e063141139fce010982780140aa0cd5ab',
        exchange: '0x5d8c9ba74607d2cbc4176882a42d4ace891c1c00',
        bridgeAdapterAddresses: {
            balancerBridge: '0x47697b44bd89051e93b4d5857ba8e024800a74ac',
            curveBridge: '0x1796cd592d19e3bcd744fbb025bb61a6d8cb2c09',
            kyberBridge: '0x0000000000000000000000000000000000000000',
            mooniswapBridge: '0x0000000000000000000000000000000000000000',
            mStableBridge: '0x0000000000000000000000000000000000000000',
            oasisBridge: '0x0000000000000000000000000000000000000000',
            uniswapBridge: '0x0000000000000000000000000000000000000000',
            uniswapV2Bridge: '0x0000000000000000000000000000000000000000',
            kyberNetworkProxy: '0xd719c34261e099Fdb33030ac8909d5788D3039C4',
            oasis: '0x0000000000000000000000000000000000000000',
            uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            uniswapExchangeFactory: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351',
            mStable: '0x4E1000616990D83e56f4b5fC6CC8602DcfD20459',
            weth: '0xc778417e063141139fce010982780140aa0cd5ab',
        },
    },
    '4': {
        weth: '0xc778417e063141139fce010982780140aa0cd5ab',
        exchange: '0xf8becacec90bfc361c0a2c720839e08405a72f6d',
        bridgeAdapterAddresses: {
            balancerBridge: '0x5d8c9ba74607d2cbc4176882a42d4ace891c1c00',
            curveBridge: '0x1796cd592d19e3bcd744fbb025bb61a6d8cb2c09',
            kyberBridge: '0x0000000000000000000000000000000000000000',
            mooniswapBridge: '0x0000000000000000000000000000000000000000',
            mStableBridge: '0x0000000000000000000000000000000000000000',
            oasisBridge: '0x0000000000000000000000000000000000000000',
            uniswapBridge: '0x0000000000000000000000000000000000000000',
            uniswapV2Bridge: '0x0000000000000000000000000000000000000000',
            kyberNetworkProxy: '0x0d5371e5EE23dec7DF251A8957279629aa79E9C5',
            oasis: '0x0000000000000000000000000000000000000000',
            uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            uniswapExchangeFactory: '0xf5D915570BC477f9B8D6C0E980aA81757A3AaC36',
            mStable: '0x0000000000000000000000000000000000000000',
            weth: '0xc778417e063141139fce010982780140aa0cd5ab',
        },
    },
    '42': {
        weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
        exchange: '0xf1ec7d0ba42f15fb5c9e3adbe86431973e44764c',
        bridgeAdapterAddresses: {
            balancerBridge: '0x407b4128e9ecad8769b2332312a9f655cb9f5f3a',
            curveBridge: '0x81c0ab53a7352d2e97f682a37cba44e54647eefb',
            kyberBridge: '0xaecfa25920f892b6eb496e1f6e84037f59da7f44',
            mooniswapBridge: '0x0000000000000000000000000000000000000000',
            mStableBridge: '0x0000000000000000000000000000000000000000',
            oasisBridge: '0x2d47147429b474d2e4f83e658015858a1312ed5b',
            uniswapBridge: '0x0e85f89f29998df65402391478e5924700c0079d',
            uniswapV2Bridge: '0x7b3530a635d099de0534dc27e46cd7c57578c3c8',
            kyberNetworkProxy: '0x692f391bCc85cefCe8C237C01e1f636BbD70EA4D',
            oasis: '0xe325acB9765b02b8b418199bf9650972299235F4',
            uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            uniswapExchangeFactory: '0xD3E51Ef092B2845f10401a0159B2B96e8B6c3D30',
            mStable: '0x0000000000000000000000000000000000000000',
            weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
        },
    }
};

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
