// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.11;

import "./Variegate.sol";
import "./RewardsTracker.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VariegateProject is RewardsTracker {
  using SafeMath for uint256;
  using SafeMathInt for int256;

  uint256 public constant MIN_BALANCE = 250_000 ether; // TOKENS REQ FOR DIVIDENDS
  uint256 public paybackBNB = 0;
  uint256 public funds = 0;

  address payable public variegate;

  struct Holder {
    uint256 index;
    uint256 dollars;
  }

  mapping (address => Holder) public holder;
  mapping (uint256 => address) public holderAt;
  uint256 public holders = 0;

  event FundsApproved(address to, uint256 amount);

  constructor() RewardsTracker() { }

  modifier onlyAdmin() {
    require(isAdmin(_msgSender()), "Caller invalid");
    _;
  }

  function getReport() public view returns (uint256 holderCount, uint256 totalDollars, uint256 totalBNB) {
    holderCount = holders;
    totalDollars = totalBalance;
    totalBNB = totalDistributed;
  }

  function getReportAccount(address key) public view returns (address account, uint256 index, uint256 dollars, uint256 depositedBNB, uint256 withdrawnBNB) {
    account = key;
    index = holder[account].index;
    dollars = balanceOf[account];
    depositedBNB = getAccumulated(account);
    withdrawnBNB = withdrawnRewards[account];
  }

  function getReportAccountAt(uint256 indexOf) public view returns (address account, uint256 index, uint256 dollars, uint256 depositedBNB, uint256 withdrawnBNB) {
    require(indexOf > 0 && indexOf <= holders, "Value invalid");

    return getReportAccount(holderAt[indexOf]);
  }

  function requestFunds(address to, uint256 amount) external onlyAdmin {
    require(funds > amount, "Overdraft");

    if (!isConfirmed(2)) return;

    funds -= amount;
    (bool success,) = payable(to).call{ value: amount, gas: 3000 }("");
    if (success) {
      emit FundsApproved(to, amount);
    } else {
      funds += amount;
    }
  }

  function setHolders(address[] memory accounts, uint256[] memory dollars) external onlyAdmin { // REWARDS TRACKER REQUIRES OWNER
    require(totalBalance==0, "Already set.");
    require(accounts.length<100, "100 accounts max");

    for (uint256 idx=0;idx<accounts.length;idx++) setHolder(accounts[idx], dollars[idx]);

    paybackBNB = (totalBalance * 1 ether).div(333); // FOR EACH $1K RETURN 3 BNB - ADJUST BNB PRICE AT LAUNCH
  }

  function withdrawFunds(address payable account) public override {
    verifyMinimumBalances();
    super.withdrawFunds(account);
  }

  // PRIVATE

  function _transferOwnership(address newOwner) internal override {
    super._transferOwnership(newOwner);
    if (isContract(newOwner)) variegate = payable(newOwner);
  }

  function confirmCall(uint256 required, address account, bytes4 method, bytes calldata args) private returns (bool) {
    return required < 2 || !isContract(owner()) || Variegate(variegate).confirmCall(required, account, method, args);
  }

  function distributeFunds(uint256 amount) internal override {
    if (totalDistributed >= paybackBNB) { // PAID IN FULL, NO MORE DISTRIBUTIONS
      funds += amount;
      return;
    }
    uint256 split = amount.div(10); // 20% of Fees go to pay start up costs
    funds += amount.sub(split);
    super.distributeFunds(split);
  }

  function isAdmin(address account) private view returns(bool) {
    return (!isContract(owner()) && account==owner()) || (isContract(owner()) && Variegate(variegate).isAdmin(account));
  }

  function isConfirmed(uint256 required) private returns (bool) {
    return required < 2 || !isContract(owner()) || Variegate(variegate).confirmCall(required, msg.sender, msg.sig, msg.data);
  }

  function isContract(address key) private view returns (bool) {
    return key.code.length > 0;
  }

  function setHolder(address account, uint256 dollars) internal {
    updateBalance(account, dollars);
    if (holder[account].index==0) {
      holders++;
      holderAt[holders] = account;
      holder[account].index = holders;
    }
    holder[account].dollars = dollars;
  }

  function verifyMinimumBalances() internal {
    if (!isContract(owner())) return;

    for (uint idx; idx<holders; idx++) {
      address account = holderAt[idx];
      uint256 balance = IERC20(owner()).balanceOf(account);

      if (balanceOf[account] > 0 && balance < MIN_BALANCE) {
        updateBalance(account, 0);
      } else if (balanceOf[account]==0 && balance >= MIN_BALANCE) {
        updateBalance(account, holder[account].dollars); // RESTORE ORIGINAL SHARE
      }
    }
  }
}
