'use strict'
const assert = require('assert');
const {
    createEcosystemContract,
    deployEcosystemContract,
    deployTransformer,
    enterSenderContext,
    verifyQueuedSources,
} = require('../../../util');

const EXCHANGE_ADDRESSES = {
    '1': '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
    '3': '0x5d8C9Ba74607D2cbc4176882A42D4ACE891c1c00',
    '4': '0xf8becacec90bfc361c0a2c720839e08405a72f6d',
    '42': '0xF1eC7d0BA42f15fb5c9E3aDBe86431973e44764C',
};

const TRANSFORMER_DEPLOYER_ADDRESSES = {
    '1': '0x39dce47a67ad34344eab877eae3ef1fa2a1d50bb',
    '3': '0x1c9a27658dd303a31205a3b245e8993b92d4d502',
    '4': '0x1c9a27658dd303a31205a3b245e8993b92d4d502',
    '42': '0x1b62de2dbb5e7aa519e9c442721ecef75702807f',
};

const ADAPTER_ADDRESSES = {
    '1': {
        balancerBridge: "0xfe01821ca163844203220cd08e4f2b2fb43ae4e4",
        creamBridge: "0xb9d4bf2c8dab828f4ffb656acdb6c2b497d44f25",
        curveBridge: "0x1796cd592d19e3bcd744fbb025bb61a6d8cb2c09",
        dodoBridge: "0xe9da66965a9344aab2167e6813c03f043cc7a6ca",
        kyberBridge: "0xadd97271402590564ddd8ad23cb5317b1fb0fffb",
        mooniswapBridge: "0x02b7eca484ad960fca3f7709e0b2ac81eec3069c",
        mStableBridge: "0x2bf04fcea05f0989a14d9afa37aa376baca6b2b3",
        oasisBridge: "0x991c745401d5b5e469b8c3e2cb02c748f08754f1",
        shellBridge: "0xf1c0811e3788caae7dbfae43da9d9131b1a8a148",
        snowSwapBridge: "0xb1dbe83d15236ec10fdb214c6b89774b454754fd",
        swerveBridge: "0xf9786d5eb1de47fa56a8f7bb387653c6d410bfee",
        sushiswapBridge: "0x47ed0262a0b688dcb836d254c6a2e96b6c48a9f5",
        uniswapBridge: "0x36691c4f426eb8f42f150ebde43069a31cb080ad",
        uniswapV2Bridge: "0xdcd6011f4c6b80e470d9487f5871a0cba7c93f48",
        kyberNetworkProxy: "0x9AAb3f75489902f3a48495025729a0AF77d4b11e",
        oasis: "0x794e6e91555438aFc3ccF1c5076A74F42133d08D",
        sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        uniswapV2Router: "0xf164fC0Ec4E93095b804a4795bBe1e041497b92a",
        uniswapExchangeFactory: "0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95",
        mStable: "0xe2f2a5C287993345a840Db3B0845fbC70f5935a5",
        dodoHelper: "0x533dA777aeDCE766CEAe696bf90f8541A4bA80Eb",
        weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    '3': {
        balancerBridge: "0x0000000000000000000000000000000000000000",
        creamBridge: "0x0000000000000000000000000000000000000000",
        curveBridge: "0x0000000000000000000000000000000000000000",
        dodoBridge: "0x0000000000000000000000000000000000000000",
        kyberBridge: "0x0000000000000000000000000000000000000000",
        mooniswapBridge: "0x0000000000000000000000000000000000000000",
        mStableBridge: "0x0000000000000000000000000000000000000000",
        oasisBridge: "0x0000000000000000000000000000000000000000",
        shellBridge: "0x0000000000000000000000000000000000000000",
        snowSwapBridge: "0x0000000000000000000000000000000000000000",
        swerveBridge: "0x0000000000000000000000000000000000000000",
        sushiswapBridge: "0x0000000000000000000000000000000000000000",
        uniswapBridge: "0x0000000000000000000000000000000000000000",
        uniswapV2Bridge: "0x0000000000000000000000000000000000000000",
        kyberNetworkProxy: "0x0000000000000000000000000000000000000000",
        oasis: "0x0000000000000000000000000000000000000000",
        sushiswapRouter: "0x0000000000000000000000000000000000000000",
        uniswapV2Router: "0xf164fC0Ec4E93095b804a4795bBe1e041497b92a",
        uniswapExchangeFactory: "0x0000000000000000000000000000000000000000",
        mStable: "0x0000000000000000000000000000000000000000",
        dodoHelper: "0x0000000000000000000000000000000000000000",
        weth: "0xc778417e063141139fce010982780140aa0cd5ab",
    },
    '4': {
        balancerBridge: "0x0000000000000000000000000000000000000000",
        creamBridge: "0x0000000000000000000000000000000000000000",
        curveBridge: "0x0000000000000000000000000000000000000000",
        dodoBridge: "0x0000000000000000000000000000000000000000",
        kyberBridge: "0x0000000000000000000000000000000000000000",
        mooniswapBridge: "0x0000000000000000000000000000000000000000",
        mStableBridge: "0x0000000000000000000000000000000000000000",
        oasisBridge: "0x0000000000000000000000000000000000000000",
        shellBridge: "0x0000000000000000000000000000000000000000",
        snowSwapBridge: "0x0000000000000000000000000000000000000000",
        swerveBridge: "0x0000000000000000000000000000000000000000",
        sushiswapBridge: "0x0000000000000000000000000000000000000000",
        uniswapBridge: "0x0000000000000000000000000000000000000000",
        uniswapV2Bridge: "0x0000000000000000000000000000000000000000",
        kyberNetworkProxy: "0x0000000000000000000000000000000000000000",
        oasis: "0x0000000000000000000000000000000000000000",
        sushiswapRouter: "0x0000000000000000000000000000000000000000",
        uniswapV2Router: "0xf164fC0Ec4E93095b804a4795bBe1e041497b92a",
        uniswapExchangeFactory: "0x0000000000000000000000000000000000000000",
        mStable: "0x0000000000000000000000000000000000000000",
        dodoHelper: "0x0000000000000000000000000000000000000000",
        weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab'
    },
    '42': {
        balancerBridge: "0x0000000000000000000000000000000000000000",
        creamBridge: "0x0000000000000000000000000000000000000000",
        curveBridge: "0x0000000000000000000000000000000000000000",
        dodoBridge: "0x0000000000000000000000000000000000000000",
        kyberBridge: "0x0000000000000000000000000000000000000000",
        mooniswapBridge: "0x0000000000000000000000000000000000000000",
        mStableBridge: "0x0000000000000000000000000000000000000000",
        oasisBridge: "0x0000000000000000000000000000000000000000",
        shellBridge: "0x0000000000000000000000000000000000000000",
        snowSwapBridge: "0x0000000000000000000000000000000000000000",
        swerveBridge: "0x0000000000000000000000000000000000000000",
        sushiswapBridge: "0x0000000000000000000000000000000000000000",
        uniswapBridge: "0x0000000000000000000000000000000000000000",
        uniswapV2Bridge: "0x0000000000000000000000000000000000000000",
        kyberNetworkProxy: "0x0000000000000000000000000000000000000000",
        oasis: "0x0000000000000000000000000000000000000000",
        sushiswapRouter: "0x0000000000000000000000000000000000000000",
        uniswapV2Router: "0xf164fC0Ec4E93095b804a4795bBe1e041497b92a",
        uniswapExchangeFactory: "0x0000000000000000000000000000000000000000",
        mStable: "0x0000000000000000000000000000000000000000",
        dodoHelper: "0x0000000000000000000000000000000000000000",
        weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C'
    },
};

(async () => {
    await enterSenderContext(async ({chainId}) => {
        const deployer = createEcosystemContract(
            'zero-ex/TransformerDeployer',
            TRANSFORMER_DEPLOYER_ADDRESSES[chainId],
        );
        // TransformerDeployer is bugged. This will fail.
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
    });
    await verifyQueuedSources();
})();
