## Deploying Token on Remix

Before starting you should have:

* a list of addresses for the 3 adminstrators
* a list of addresses and corresponding list of pre-launch expense amounts for those addresses.

### 1. Flatten Variegate.sol and compile

Using Remix, flatten and save the Variegate.sol file. This will contain the
sources of all 3 tokens - Variegate, VariegateRewards and VariegateProject. Be sure to
set the IUniswapV2Router02 to the correct Pancakeswap address for the network.
Use the following settings on Remix to compile:

* compiler: `v0.8.11+commit.d7f03943`
* optimize: `true`
* runs: `200`
* evmVersion: `london`

### 2. Deploy Variegate token.

From the deploy tab, select `Variegate - Variegate_flat.sol` from the
contract droplist and click deploy. Approve the transactions on metamask and after
a few seconds you should see the new contract under `Deployed Contracts`. Make a note
of this address. This is the token contract address.

### 3. Verify Variegate token code on bscscan.

Go to the contract on bscscan `https://testnet.bscscan.com/verifyContract?a=_token_address_`
and verify the source code. Enter the following settings:

* compiler type: `solidity (single file)`
* compiler version: `v0.8.11+commit.d7f03943`
* open source license type: `mit`

Agree to terms and continue to next page. Enter the following settings:

* optimization: `yes`
* solidity contract code: copy/paste entire `Variegate_flat.sol` into text area
* misc settings / runs: `200`
* misc settings / evmVersion: `london`

Prove you are not a robot and click `Verify and Publish`

### 4. Deploy VariegateRewards contract.

From the deploy tab, select `VariegateRewards - Variegate_flat.sol` from the contract
droplist and click deploy. Approve the transactions on metamask and after
a few seconds you should see the new contract under `Deployed Contracts`.

### 5. Verify VariegateRewards contract on bscscan.

Repeat step 3 but this time verifying the VariegateRewards contract using the same `Variegate_flat.sol`
source file.

### 6. Deploy VariegateProject contract.

From the deploy tab, select `VariegateProject - Variegate_flat.sol` from the contract
droplist and click deploy. Approve the transactions on metamask and after
a few seconds you should see the new contract under `Deployed Contracts`.

### 7. Verify VariegateProject contract on bscscan.

Repeat step 3 but this time verifying the VariegateProject contract using the same `Variegate_flat.sol`
source file.

### 8. Link Variegate and VariegateProject contracts.

From either remix or bscscan contract tab, run the following commands on each contract:

  * 1. VariegateProject: `transferOwnership(_variegate_token_address_)`
  * 2. Variegate: `setProjectContract(_variegate_project_address_)`

### 9. Link Variegate and VariegateRewards contracts.

From either remix or bscscan contract tab, run the following commands on each contract:

  * 1. VariegateRewards: `transferOwnership(_variegate_token_address_)`
  * 2. Variegate: `setRewardsContract(_variegate_rewards_address_)`

### 10. Establish VariegateProject Administrators

The project wallet requires 3 administrators to operate. Run the following command
with an array of addresses of the administrator wallets to define the accounts:

* Variegate: `setAdmins([_address1_, _address2_, _address3_])`

This action can only be done once so double check. After this is set, changing an
admin will require using `replaceAdmin` and going through the confirmation process.

### 11. Establish VariegateProject Seed Investors

The project wallet requires seed investors and amounts to pay back loans. Run the
following command with two arrays of equal length to define the investor accounts
and their seed dollar amounts.

* VariegateProject: `setHolders([_holder1_, _holder2_, ...], [_amount1_, _amount2_, ...])`

This action can only be done once ever so quadruple check the two arrays line up correctly.
The amounts supplied should be dollar amounts with no decimals.

Two admins have to make this call with the same data within 15 mins for this to work.

### 12. Supply initial liquidity to Variegate token

Send the contract BNB and tokens to be paired as initial liquidty in PanCakeSwap. The
LP tokens generated will be sent to the owner after creation to be locked.

From metamask, send initial liquidity BNB to the contract.

From either remix or bscscan contract tab, run the following commands:

  * Variegate: `transfer(to: _variegate_token_address_, amount: _half_final_supply_)`

### 13. Open contract to public

Run the following command to open the contract to public trading.

* Variegate: `openToPublic()`

This action can only be done once ever and cannot be undone. Choose wisely.

Two admins have to make this call within 15 mins for this to work.
