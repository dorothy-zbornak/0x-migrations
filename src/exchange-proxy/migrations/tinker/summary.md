### Features:
Redeploy the following features to support allowances directly on the exchange proxy:
    - `TransformERC20Feature`
    - `UniswapFeature`

Deploy a new feature `LiquidityProviderFeature` which provides a VIP path for liquidity provider only routes.

### Rollback
There was a partial rollback of the following functions:
    - `_transformERC20()`
    - `transformERC20()`
    - `sellToUniswap()`
