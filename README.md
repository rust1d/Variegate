# Variegate Token

Variegate token features a unique system of rewards and micro-staking to encourage
holding for extended periods. All accounts holding at least 500k tokens are eligible
to automatically earn rewards that increase over time based on their last sell. Rewards
are paid out to holder in a different BEP20/BSC token each day. The rewards tokens
paid to holder will be voted on by the Variegate community and changed on a
regular basis.

## Total Supply, Max Wallet and Max Sell Amounts

* The contract has a fully minted final supply of 1 billion tokens.
* The contract has a hardcoded max wallet size of 15 million tokens.
* The contract has a hardcoded max sell limit of 5 million tokens.

# Fees

**Transfers** between wallets are never subjected to any fees.

**Buys** are subjected to a fee of 8%. 6% is sent to the rewards system and 2% is sent
to the project wallet.

**Sells** are subjected to a fee of 12%. 10% is sent to the rewards system and 2% is
sent to the project wallet.

## Rewards

Rewards tokens collected from sell fees are converted into BNB. Holders meeting the
minimum required balance will automatically earn a share of these rewards. Rewards are
earned proportionate to the holder's eligible tokens in the pool of all eligible tokens.
Any holder with the minimum balance will start with 50% of their tokens added to the pool
of tokens tracked. This amount will increased by 1% for each day the holder goes without
selling until 100% is reached and they are fully vested. Any reduction of tokens, either
by selling or transferring, will drop the holder back to 50% and restart the vesting
process. Buying or receiving more tokens will immediately include those tokens in the
rewards system at the current vesting percent.

* The percent of tokens eligible to earn rewards is `50% + 1% * days since sell` capped at 100%.

### Claiming Rewards

When rewards are claimed for a holder, all pending BNB in their name is converted into
the current token of the day and sent to the holder's wallet. Holders can choose to
wait for rewards to be auto delivered. A small number of claims are automatically
processed during each transaction depending upon current gas prices. Claims are
processed in a circular order from the first holder to the last. Periods of low
transactions will process less claims so manually claiming rewards is an option.

Holders can use the `rewards.withdrawFunds` function to manually claim pending
rewards once per waiting period.

### Rewards Reporting

Holders can use the `rewards.getRewardsReport` function to view a summary report of
the rewards tracker.

Holders can use the `rewards.getRewardsReportAccount` function to get a summary report
of their account in the rewards tracker.

## Project Funding

Project tokens collected from sell fees are converted into BNB and sent to the project
wallet to be used for marketing, utility development and discretionary spending.

## Contract Functions

There are 3 contracts that manage the Variegate ecosystem.

1. Variegate - ERC20 token handling transaction fees
2. VariegateRewards - smart contract handling rewards system
3. VariegateProject - smart contract handling project funds and function permissions

### Variegate Functions

`accumulatedProject`

Total tokens currently held by the project accumulator.

`accumulatedRewards`

Total tokens currently held by the rewards accumulator.

`gasLimit`

Maximum amount of gas to spend processing rewards on each transaction.

`isAdmin(address)`

Returns True if the address is a Variegate administrator.

`isFeeless(address)`

Returns True if the address will pay transaction fees.

`isPresale(address)`

Returns True if the address can transfer tokens before public release.

`swapThreshold`

Threshold at which accumulated tokens are converted to BNB.

### VariegateRewards Functions

`currentSlot()`

Displays the slot for the active rewards token.

`getReport`

Displays rewards system summary data

* holderCount - total holders eligible for rewards
* stakingOn - is sell date staking active? true/false
* totalTokensTracked - total tokens tracked by rewards system
* totalTokensStaked - total tokens staked by rewards system
* totalRewardsPaid - total amount of BNB distributed by rewards system
* requiredBalance - minimum tokens required to qualify for rewards
* waitPeriodSeconds - waiting time between manual claims

`getReportAccount(address)`

Displays summary report for a holder account in the rewards system.

* excluded - has holder been excluded from rewards
* index - holder position in processing queue
* balance - holder tokens tracker by rewards
* stakedPercent - percent of holders tokens currently staked for rewards
* stakedTokens - holder tokens staked by rewards system
* rewardsEarned - total rewards holder has earned
* rewardsClaimed - total rewards holder has claimed
* claimHours - hours since last claim

`getReportAccountAt(position)`

Displays summary report for a holder account indexed at this position.

`getReportToken(address)`

Displays summary report for an ERC20 token in the rewards system.

* name - token name
* symbol - token symbol
* tokenAddress - contract adress
* claims - total claims processed
* balance - total tokens bought
* amount - total BNB spent on tokens

`getReportTokenInSlot(slot)`

Displays summary report for reward token current in this slot. Passing 0 will return the
report for the currently active token.

`getTokens`

Displays the names of the current reward tokens.

`holders`

Count of token holders tracked by rewards system.

`holderAt(position)`

Holder indexed at this position.

`holder(address)`

Displays internal tracking data for the holder account if it exists.

* index - indexed position
* balance - holder tokens tracker by rewards
* percent - percent of holders tokens currently staked for rewards
* added - added timestamp
* excluded - excluded timestamp
* bought - last buy timestamp
* sold - last sell timestamp
* claimed - last reward claim timestamp

`minimumBalance`

Displays minimum tokens required to qualify for rewards

`processClaims(gas)`

Processes pending rewards claims until supplied `gas` is exhausted.

`slots`

Displays the number of reward token currently slotted for rewards distribution.

`tokens`

Count of rewards tokens entered in system.

`tokenAt(position)`

Rewards token indexed at this position.

`tokenInSlot(slot)`

Reward token currently in this slot.

`token(address)`

Display internal tracking data for the ERC20 rewards token if it exists.

* token - contract address
* index - indexed position
* added - added timestamp
* claims - total claims processed
* balance - total tokens bought
* amount - total BNB spent on tokens

`waitingPeriod`

Displays current waiting period between claims in seconds.

`withdrawFunds(address)`

Allows a holder to manually withdraw pending rewards.





## Owner Functions

`*` In order to call these functions the owner must provide gas.

`openToPublic`

Allows owner to open the contract to the public. It cannot be undone.

* Contract is closed to the public until opened by the owner. This cannot be undone.
* When opened, the BNB and tokens held by the contract is converted to LP and sent to the owner to lock.
* After opening liquidity wallet is set to the contract address and will never change.

`processRewardsClaims`

Allows owner to manually process pending token claims and update staking positions
in the rewards system.

`setAutomatedMarketMakerPair`

Allows owner to add new LP pairs to the token. Necessary to support additional token
features in the future.

`setFeeless`

Allows owner to add/remove accounts from paying fees on transactions. Necessary to
support additional token features in the future.

`setGasLimit`

Allows owner to change the amount of gas used during auto-processing of claims.

* Gas for auto-processing defaults to 300,000 wei and can be changed to a value
between 250,000 and 750,000 wei.

`setPresale`

Allows owner to add/remove accounts from the presale list that allows transferring
tokens before the contract is public.

`setProjectWallet`

Allows owner to change the address project funds are sent to.

`setRewardsExcludedAddress`

Allows owner to remove accounts from participating in rewards. Necessary to support
additional token features in the future.

`setRewardsMinimumBalance`

* The minimum required balance defaults to 15 million and can be changed to any value
between 1 and 15 million.

`setRewardsTracker`

Allows owner to switch the rewards tracker contract.

* Rewards tracker can be locked for 3 months (TODO).

`setRewardsWaitingPeriod`

Allows owner to set the time between manual reward claims.

* The waiting period between claims defaults to 6 hours and can be changed to any
value between 1 and 24 hours.

`setStaking`

Allows owner to enable/disable the last sell date staking option of the rewards system.

## Disclaimer

This document attempts to accurately describe the functionality of the smart contract.
If any discrepancies arise between this document and the contract code, the code stands
as the canonical source of the truth.

***

## Deploying Token on Remix
### 1. Flatten VariegateProject.sol and compile

Using Remix, flatten and save the VariegateProject.sol file. This will contain the
sources of all 3 tokens - Variegate, VariegateRewards and VariegateProject. Be sure to
set the IUniswapV2Router02 to the correct Pancakeswap address for the network.
Use the following settings on Remix to compile:

* compiler: `v0.8.11+commit.d7f03943`
* optimize: `true`
* runs: `200`
* evmVersion: `spuriousDragon`

### 2. Deploy VariegateProject token.

From the deploy tab, select `VariegateProject - VariegateProject_flat.sol` from the
contract droplist and click deploy. Approve the transactions on metamask and after
a few seconds you should see the new contract under `Deployed Contracts`.

### 3. Verify VariegateProject token on bscscan.

Go to the contract on bscscan `https://testnet.bscscan.com/verifyContract?a=_project_address_`
and verify the source. Enter the following settings:

* compiler type: `solidity (single file)`
* compiler version: `v0.8.11+commit.d7f03943`
* open source license type: `mit`

Agree to terms and continue to next page. Enter the following settings:

* optimization: `yes`
* solidity contract code: copy/paste entire `VariegateProject_flat.sol` into text area
* misc settings / runs: `200`
* misc settings / evmVersion: `spuriousDragon`

Prove you are not a robot and click `Verify and Publish`

### 4. Deploy Variegate token.

From the deploy tab, select `Variegate - VariegateProject_flat.sol` from the contract
droplist and click deploy. Approve the transactions on metamask and after
a few seconds you should see the new contract under `Deployed Contracts`.

### 5. Verify Variegate token on bscscan.

Repeat step 3 but this time verifying the Variegate token using the same `VariegateProject_flat.sol`
source file.

### 6. Link Variegate and VariegateProject tokens.

From either remix or bscscan contract tab, run the following commands on each contract:

  * Variegate: `setProjectWallet(_project_address_)`
  * VariegateProject: `setToken(_odyssey_address_)`

### 7. Establish VariegateProject CEO/CFOs

The project wallet requires 4 chief officers to operate. Run the following command
with an array of addresses of the officers wallets to define the CEO and CFO accounts:

* VariegateProject: `setOfficers([_ceo1_, _ceo2_, _cfo1_, _cfo2_])`

This action can only be done once so double check. After this is set, changing officers
will require going through the voting process using the addresses supplied.

### 8. Establish VariegateProject Seed Investors

The project wallet requires seed investors and amounts to pay back loans. Run the
following command with two arrays of equal length to define the investor accounts
and their seed dollar amounts.

* VariegateProject: `setHolders([_holder1_, _holder2_, ...], [_amount1_, _amount2_, ...])`

This action can only be done once ever so quadruple check the two arrays line up correctly.
The amounts supplied should be dollar amounts with no decimals.

### 9. Supply initial liquidity to Variegate token

Send the contract BNB and tokens to be paired as initial liquidty in PanCakeSwap. The
LP tokens generated will be sent to the owner after creation to be locked.

From metamask, send initial liquidity BNB to the contract.

From either remix or bscscan contract tab, run the following commands:

  * Variegate: `transfer(to: _odyssey_address_, amount: _half_final_supply_)`

### 10. Open contract to public

Run the following command to open the contract to public trading.

* Variegate: `openToPublic()`

This action can only be done once ever and cannot be undone. Choose wisely.

### 11. Verify VariegateRewards contract

Repeat step 3 but this time verifying the VariegateRewards contract using the same `VariegateProject_flat.sol`
source file. You will need to provide the constructor arguments `("VariegateRewards", "ODSYRV1")` in
ABI-encoded format. The encoded data is provided below:

* Constructor Arguments ABI-encoded: `00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000e4f6479737365795265776172647300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000074f44535952563100000000000000000000000000000000000000000000000000`
