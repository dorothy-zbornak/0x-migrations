### Features:
- MetaTransactions
- Uniswap (VIP)

### Etc
- Unregister old `_transformERC20()` function that was missed in the last migration.
- Set the default timelock for the govenror to 24 hours.
- Set custom (zero) timelocks for the following:
    - `AllowanceTarget.removeAuthorizedAddress()`
    - `AllowanceTarget.removeAuthorizedAddressAtIndex()`
    - `ZeroEx.rollback()`
