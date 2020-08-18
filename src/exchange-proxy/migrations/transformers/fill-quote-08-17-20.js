'use strict'
const assert = require('assert');
const BigNumber = require('bignumber.js');
const _ = require('lodash');
const {
    createEcosystemContract,
    encodeGovernorCalls,
    deployEcosystemContract,
    deployTransformer,
    ETH,
    NULL_ADDRESS,
    SECRETS,
    SENDER,
    SEND_OPTS,
    SIMULATED,
    verifyQueuedSources,
    verifySource,
    wait,
} = require('../../../util');

const EXCHANGE_ADDRESSES = {
    '1': '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
    '3': '0x5d8C9Ba74607D2cbc4176882A42D4ACE891c1c00',
    '4': '0xf8becacec90bfc361c0a2c720839e08405a72f6d',
    '42': '0xF1eC7d0BA42f15fb5c9E3aDBe86431973e44764C',
};

const ADAPTER_ADDRESSES = {
    '1': {
        balancerBridge: '0xfe01821Ca163844203220cd08E4f2B2FB43aE4E4',
        curveBridge: '0x1796Cd592d19E3bcd744fbB025BB61A6D8cb2c09',
        kyberBridge: '0x1c29670F7a77f1052d30813A0a4f632C78A02610',
        mStableBridge: '0x2bF04fceA05F0989A14d9AFA37aa376bAca6b2b3',
        oasisBridge: '0x991C745401d5b5e469B8c3e2cb02C748f08754f1',
        uniswapBridge: '0x36691C4F426Eb8F42f150ebdE43069A31cB080AD',
        uniswapV2Bridge: '0xDcD6011f4C6B80e470D9487f5871a0Cba7C93f48',
        kyberNetworkProxy: '0x9AAb3f75489902f3a48495025729a0AF77d4b11e',
        oasis: '0x794e6e91555438aFc3ccF1c5076A74F42133d08D',
        uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapExchangeFactory: '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95',
        mStable: '0xe2f2a5C287993345a840Db3B0845fbC70f5935a5',
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    },
    '3': {
        balancerBridge: '0x47697b44bd89051e93b4d5857ba8e024800a74ac',
        curveBridge: '0x1796cd592d19e3bcd744fbb025bb61a6d8cb2c09',
        kyberBridge: '0x0000000000000000000000000000000000000000',
        mStableBridge: '0x0000000000000000000000000000000000000000',
        oasisBridge: '0x0000000000000000000000000000000000000000',
        uniswapBridge: '0x0000000000000000000000000000000000000000',
        uniswapV2Bridge: '0x0000000000000000000000000000000000000000',
        kyberNetworkProxy: '0xd719c34261e099Fdb33030ac8909d5788D3039C4',
        oasis: '0x0000000000000000000000000000000000000000',
        uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapExchangeFactory: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351',
        mStable: '0x4e1000616990d83e56f4b5fc6cc8602dcfd20459',
        weth: '0xc778417e063141139fce010982780140aa0cd5ab'
    },
    '4': {
        balancerBridge: '0x5d8c9ba74607d2cbc4176882a42d4ace891c1c00',
        curveBridge: '0x1796cd592d19e3bcd744fbb025bb61a6d8cb2c09',
        kyberBridge: '0x0000000000000000000000000000000000000000',
        mStableBridge: '0x0000000000000000000000000000000000000000',
        oasisBridge: '0x0000000000000000000000000000000000000000',
        uniswapBridge: '0x0000000000000000000000000000000000000000',
        uniswapV2Bridge: '0x0000000000000000000000000000000000000000',
        kyberNetworkProxy: '0x0d5371e5EE23dec7DF251A8957279629aa79E9C5',
        oasis: '0x0000000000000000000000000000000000000000',
        uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapExchangeFactory: '0xf5D915570BC477f9B8D6C0E980aA81757A3AaC36',
        mStable: '0x0000000000000000000000000000000000000000',
        weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab'
    },
    '42': {
        balancerBridge: '0x407b4128e9ecad8769b2332312a9f655cb9f5f3a',
        curveBridge: '0x81c0ab53a7352d2e97f682a37cba44e54647eefb',
        kyberBridge: '0x0000000000000000000000000000000000000000',
        mStableBridge: '0x0000000000000000000000000000000000000000',
        oasisBridge: '0x0000000000000000000000000000000000000000',
        uniswapBridge: '0x0000000000000000000000000000000000000000',
        uniswapV2Bridge: '0x0000000000000000000000000000000000000000',
        kyberNetworkProxy: '0x692f391bCc85cefCe8C237C01e1f636BbD70EA4D',
        oasis: '0xe325acB9765b02b8b418199bf9650972299235F4',
        uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapExchangeFactory: '0xD3E51Ef092B2845f10401a0159B2B96e8B6c3D30',
        mStable: '0x0000000000000000000000000000000000000000',
        weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C'
    },
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
    const { address: bridgeAdapterAddress } = await deployEcosystemContract(
        'zero-ex/BridgeAdapter',
        ADAPTER_ADDRESSES[chainId],
    );
    console.log(`deployed BridgeAdapter at ${bridgeAdapterAddress.green.bold}`);
    const deployedAddress = await deployTransformer(
        deployer,
        'FillQuoteTransformer',
        EXCHANGE_ADDRESSES[chainId],
        bridgeAdapterAddress,
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
    if (!SIMULATED) {
        await wait(60e3);
        await verifyQueuedSources();
    }
})();
