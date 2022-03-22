# Variegate Token

Variegate token features a unique system of rewards and micro-staking to encourage
holding for extended periods. All accounts holding at least 500k tokens are eligible
to automatically earn rewards that increase over time based on their last sell. Rewards
are paid out to holder in a different BEP20/BSC token by day. The rewards tokens
paid to holder will be voted on by the Variegate community and changed on a
regular basis.

## Total Supply, Max Wallet and Max Sell Amounts

* The contract has a fully minted final supply of 1 billion tokens.
* The contract has a hardcoded max wallet size of 15 million tokens.
* The contract has a hardcoded max sell limit of 5 million tokens.

# Fees

**Transfers** between wallets are never subjected to any fees.

**Buys** are subjected to a total fee of 8% - 6% rewards / 2% project

**Sells** are subjected to a total fee of 12% - 10% rewards / 2% project

## Rewards

Rewards tokens collected from sell fees are converted into BNB. Holders meeting the
minimum required balance will automatically earn a share of these rewards. Rewards are
earned proportionate to the holder's eligible tokens in the pool of all eligible tokens.

### Diamond Hands Staking

Any holder with the minimum balance will have at least 50% of their tokens staked in
the tracking pool. This percent will increased by 1% for each day the wallet goes without
selling until 100% is reached and their tokens are fully staked. _Any_ reduction of
tokens, either by selling or transferring, will drop the stake back to 50% and restart
the process at 50%. Any additional tokens bought or received will immediately be included
tracking pool at the holder's current staked percent.

* The percent of tokens tracked is `50% + 1% per day since last sell (max 100%)`

### Claiming Rewards

When rewards are claimed for a holder, all pending BNB in their name is converted into
the current token of the day and sent to the holder's wallet. Holders can choose to
wait for rewards to be auto delivered. A small number of claims are automatically
processed during each transaction depending upon current gas prices. Claims are
processed in a circular order from the first holder to the last. Periods of low
transactions will process less claims so manually claiming rewards is an option.

Holders can use the `withdrawFunds` function to manually claim pending
rewards once per waiting period.

### Daily Rewards Token

The rewards contract is set up to allow rotating between up to 10 different tokens. The
current token can change each day depending upon how the admins set up the available slots.
Typically this will be setup with 7 slots, corresponding to the days of the week, and each
week day will have a different token assigned with the community favorite assigned to the
Friday, Saturday and Sunday slots.

### Rewards Reporting

Holders can use the `getRewardsReport` function to view a summary report of
the rewards tracker.

Holders can use the `getRewardsReportAccount` function to get a summary report
of their account in the rewards tracker.

## Project Funding

Project tokens collected from sell fees are converted into BNB and sent to the project
contract to be used for marketing, utility development and discretionary spending.
A small portion of project funds will be used to repay expenses incurred launching
the token. The accounts and amount to be repaid are publicly visible and transparent.

## Contract Functions

There are 3 contracts that manage the Variegate ecosystem.

1. Variegate - ERC20 token handling transaction fees and distribution.
2. VariegateRewards - smart contract handling rewards system
3. VariegateProject - smart contract handling project funds and function permissions

### Variegate Token Contract Functions

These are the public functions that can be called on the Variegate token contract.

`accumulatedProject`

Total tokens currently held by the project accumulator. When the `swapThreshold` is
reached these are sold and sent to the VariegateProject contract.

`accumulatedRewards`

Total tokens currently held by the rewards accumulator. When the `swapThreshold` is
reached these are sold and sent to the VariegateRewards contract.

`gasLimit`

Maximum amount of gas to spend processing rewards on a token transfer.

`isAdmin(address)`

Returns True if the address is a Variegate administrator.

`isFeeless(address)`

Returns True if the address will pay transaction fees.

`isPresale(address)`

Returns True if the address can transfer tokens before public release.

`swapThreshold`

Threshold at which accumulated tokens are converted to BNB.

### VariegateRewards Contract Functions

These are the public functions that can be called on the VariegateRewards contract.

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

`processClaims(gas)` _requires gas_

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

`withdrawFunds(address)` _requires gas_

Allows a holder to manually withdraw pending rewards.


### VariegateProject Contract Functions

These are the public functions that can be called on the VariegateProject contract.

`admins`

List of the Variegate administrator account.

`funds`

Display current project funds available for withdraw.

`getReport()`

Displays payback system summary data

* holderCount - Count of accounts being paid
* totalDollars - Total start up USD to be repaid
* totalBNB - Total BNB repaid to date

`getReportAccount(address)`

* dollars - start up USD to be repaid
* depositedBNB - BNB deposited in account
* withdrawnBNB - BNB withdrawn from account

`holders`

Count of accounts tracked by payback system.

`holderAt(position)`

Account indexed at this position.

`holder(address)`

Displays internal tracking data for the account if it exists.

`isAdmin(address)`

Returns true if address is a Variegate administrator.

`paybackBNB`

Total amount of BNB to be repaid for startup costs.

`withdrawFunds(address)` _requires gas_

Allows an account to withdraw their BNB.





## Variegate Administrator

The Variegate project enforces permissions across all Variegate contracts to ensure
only approved administrators can access critical functions. Some functions will
required approval from a 2nd admin and very sensitive functions will require the
approval of all admins.

### Variegate Token Administrator Functions

`openToPublic`

Allows owner to open the contract to the public.

* Contract is closed to the public until opened by the owner. This cannot be undone.
* When opened, the BNB and tokens held by the contract is converted to LP and sent to the owner to lock.

`setAutomatedMarketMakerPair`

Add new LP pairs to the token. Necessary to support additional token features in the future.

`setFeeless`

Add/remove accounts from paying fees on transactions. Necessary to
support additional token features in the future.

`setGasLimit`

Change the amount of gas used during auto-processing of claims.

* Gas for auto-processing defaults to 300,000 wei and can be changed to a value
between 250,000 and 750,000 wei.

`setPresale`

Add/remove accounts from the presale list that allows transferring
tokens before the contract is public.

`setProjectContract` _requires confirmation by all admins_

Changes the project contract.

`setRewardsContract` _requires confirmation by all admins_

Changes the rewards contract.


### VariegateRewards Administrator Functions

`addToken(contact)`

Adds a BEP20/ERC20 token to the rewards system. Once the token is added, it can be
assigned to a daily slot for rewarding.

`deleteSlot(slot)`

Removes the slot from the active token list and reduces the slot count.

`deleteToken(address)`

Deletes the token and all tracking data from the rewards system.

`setExcluded(address, setting)` _requires confirmation by 2nd admin_

Sets the exclusion flag on an account. When true the account will be ignored by the
rewards system.

`setCurrentSlot(slot)`

Forces a token slot to be the active slot. Used to align a slot with a day of the week.

`setMinimumBalance(amount)` _requires confirmation by 2nd admin_

Sets the minimum required balance to earn rewards.

* The minimum required balance defaults to 500k tokens and can be changed to any value
between 100k and 500k.

`setSlot(slot, address)`

Changes the token in the slot to the contract address passed. If slot=0 the number of
slots is increased and the token is added to the new slot.

* Token must have been previously added via `addToken`
* Only 10 token slots may be defined.

`setSlots([address, address, ...])`

Replaces all token slots with the list provided.

* Token must have been previously added via `addToken`
* Only 10 token slots may be defined.

`setStaking(setting)` _requires confirmation by 2nd admin_

Enable/disable the last sell date staking option of the rewards system.

`setWaitingPeriod(seconds)` _requires confirmation by 2nd admin_

Sets the time between manual reward claims.

* The waiting period between claims defaults to 6 hours and can be changed to any
value between 1 and 24 hours.

`trackBuy` and `trackSell` _token contract only_

These two functions can only be called by the Variegate token and are uses to track
when a holder buys or sells tokens.

### VariegateProject Administrator Functions

`replaceAdmin(from, to)` _requires confirmation by 2nd admin_

Replaces administrator with `from` address with the `to` address.

`requestFunds(address, amount)` _requires confirmation by 2nd admin_

Sends the address an amount of BNB.

## Disclaimer

This document attempts to accurately describe the functionality of the smart contracts.
When discrepancies arise between this document and the contract code, the code stands
as the defacto truth.

***
