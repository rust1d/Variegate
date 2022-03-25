// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.11;
pragma abicoder v2;

import "./Variegate.sol";
import "./RewardsTracker.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract VariegateRewards is RewardsTracker {
  using SafeMath for uint256;
  using SafeMathInt for int256;

  IUniswapV2Router02 public immutable uniswapV2Router;
  address payable public variegate;

  struct Holder {
    uint256 index;
    uint256 balance;
    uint32 percent;
    uint32 added;
    uint32 excluded;
    uint32 bought;
    uint32 sold;
    uint32 claimed;
  }

  uint256 public holders = 0;
  uint256 public currentHolder = 0;
  mapping (uint256 => address) public holderAt;
  mapping (address => Holder) public holder;

  struct Token {
    address token;
    uint256 index;
    uint256 added;     // date added
    uint256 claims;   // # of claims processed
    uint256 balance; // total tokens distributed
    uint256 amount; // total BNB of tokens distributed
  }

  uint256 public tokens = 0;
  mapping (uint256 => address) public tokenAt;
  mapping (address => Token) public token;

  uint256 public constant MAX_SLOTS = 10;
  uint256 public slots = 0;
  uint256 public offset = 0;
  mapping (uint256 => address) public tokenInSlot;

  uint256 public minimumBalance = 500_000 ether;
  uint256 public waitingPeriod = 6 hours;
  bool public isStakingOn = false;
  uint256 public totalTracked = 0;

  event ClaimsProcessed(uint256 iterations, uint256 claims, uint256 lastRecord, uint256 gasUsed);
  event ExcludedChanged(address indexed account, bool excluded);
  event MinimumBalanceChanged(uint256 from, uint256 to);
  event StakingChanged(bool from, bool to);
  event WaitingPeriodChanged(uint256 from, uint256 to);
  event TokenAdded(address indexed token, string name);
  event TokenDeleted(address indexed token, string name);
  event SlotSet(uint256 slot, address indexed token, string name);

  constructor() RewardsTracker() {
    address ROUTER_PCSV2_MAINNET = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    // address ROUTER_PCSV2_TESTNET = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    // address ROUTER_FAKEPCS_TESTNET = 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3;
    IUniswapV2Router02 router = IUniswapV2Router02(ROUTER_PCSV2_MAINNET);
    uniswapV2Router = router;
    holder[owner()].excluded = stamp();
  }

  modifier onlyAdmin() { // CALL COMES FROM OWNER OR PROJECT ADMIN
    require(isAdmin(_msgSender()), "Caller invalid");
    _;
  }

  function addToken(address key) external onlyAdmin {
    require(isContract(key), "Not a contract");
    require(token[key].added==0, "Token exists");

    token[key].token = key;
    token[key].added = stamp();
    tokens++;
    tokenAt[tokens] = key;
    token[key].index = tokens;
    emit TokenAdded(key, ERC20(key).name());
  }

  function currentSlot() public view returns (uint256) {
    if (slots==0) return 0;
    uint256 since = block.timestamp / (24 * 60 * 60) + offset;
    return (since % slots) + 1;
  }

  function deleteSlot(uint256 slot) external onlyAdmin {
    require(slot>0 && slot <= slots, "Value invalid");

    for (uint256 idx=slot; idx<slots; idx++) {
      tokenInSlot[idx] = tokenInSlot[idx+1];
    }
    delete tokenInSlot[slots];
    slots--;
  }

  function deleteToken(address remove) external onlyAdmin { // REMOVES TRACKING DATA
    require(token[remove].added > 0, "Token not found");

    token[tokenAt[tokens]].index = token[remove].index; // LAST TOKEN TAKES THIS ONES PLACE
    tokenAt[token[remove].index] = tokenAt[tokens]; // LAST TOKEN TAKES THIS ONES PLACE
    delete tokenAt[tokens];
    delete token[remove];
    tokens--;
    emit TokenDeleted(remove, ERC20(remove).name());
  }

  function getReport() external view returns (uint256 holderCount, bool stakingOn, uint256 totalTokensTracked, uint256 totalTokensStaked, uint256 totalRewardsPaid, uint256 requiredBalance, uint256 waitPeriodSeconds) {
    holderCount = holders;
    stakingOn = isStakingOn;
    totalTokensTracked = totalTracked;
    totalTokensStaked = totalBalance;
    totalRewardsPaid = totalDistributed;
    requiredBalance = minimumBalance;
    waitPeriodSeconds = waitingPeriod;
  }

  function getReportAccount(address key) public view returns (address account, uint256 index, uint256 balance, uint256 stakedPercent, uint256 stakedTokens, uint256 rewardsEarned, uint256 rewardsClaimed, uint256 claimHours) {
    require(holder[key].added > 0, "Value invalid");

    account = key;
    index = holder[account].index;
    balance = holder[account].balance;
    stakedPercent = holder[account].percent;
    stakedTokens = balanceOf[account];
    rewardsEarned = getAccumulated(account);
    rewardsClaimed = withdrawnRewards[account];
    claimHours = ageInHours(holder[account].claimed);
  }

  function getReportAccountAt(uint256 indexOf) public view returns (address account, uint256 index, uint256 balance, uint256 stakedPercent, uint256 stakedTokens, uint256 rewardsEarned, uint256 rewardsClaimed, uint256 claimHours) {
    require(indexOf > 0 && indexOf <= holders, "Value invalid");

    return getReportAccount(holderAt[indexOf]);
  }

  function getReportToken(address key) public view returns (string memory name, string memory symbol, address tokenAddress, uint256 claims, uint256 balance, uint256 amount) {
    require(token[key].added > 0, "Token not found");

    ERC20 reward = ERC20(key);
    name = reward.name();
    symbol = reward.symbol();
    tokenAddress = key;
    claims = token[key].claims;
    balance = token[key].balance;
    amount = token[key].amount;
  }

  function getReportTokenInSlot(uint256 slot) external view returns (string memory name, string memory symbol, address tokenAddress, uint256 claims, uint256 balance, uint256 amount) {
    require(slots > 0 && slot>=0 && slot <= slots, "Value invalid");

    if (slot==0) slot = currentSlot();

    return getReportToken(tokenInSlot[slot]);
  }

  function getTokens() external view returns (string[] memory) {
    string[] memory data = new string[](tokens);
    for (uint256 idx=1; idx<=slots; idx++) {
      data[idx-1] = ERC20(tokenInSlot[idx]).name();
    }
    return data;
  }

  function processClaims(uint256 gas) external {
    if (holders==0) return;

    uint256 gasUsed = 0;
    uint256 gasLeft = gasleft();
    uint256 iterations = 0;
    uint256 claims = 0;

    while (gasUsed < gas && iterations < holders) {
      bool worthy = (address(this).balance > (1 ether / 10)); // ENOUGH FUNDS TO WARRANT PUSHING?
      // IF WORTHY 1 LOOP COST MAX ~65_000 GAS, UNWORTHY MAX ~8_500 GAS
      if (gasLeft < (worthy ? 65_000 : 8_500)) break; // EXIT IF NOT ENOUGH TO PROCESS THIS ITERATION TO AVOID OOG ERROR

      currentHolder = (currentHolder % holders) + 1;
      address account = holderAt[currentHolder];
      updatedWeightedBalance(account);
      if (worthy && pushFunds(account)) claims++;
      iterations++;
      uint256 newGasLeft = gasleft();
      if (gasLeft > newGasLeft) gasUsed = gasUsed.add(gasLeft.sub(newGasLeft));
      gasLeft = newGasLeft;
    }

    emit ClaimsProcessed(iterations, claims, currentHolder, gasUsed);
  }

  function setExcluded(address account, bool setting) external onlyAdmin {
    require(setting && holder[account].excluded==0 || !setting && holder[account].excluded!=0, "Value unchanged");

    if (!isConfirmed(2)) return;

    holder[account].excluded = setting ? 0 : stamp();
    setBalance(account, holder[account].balance);
    emit ExcludedChanged(account, true);
  }

  function setCurrentSlot(uint256 slot) external onlyAdmin {
    require(slot>0 && slot <= slots, "Value invalid");
    offset = 0;
    offset = (slots + slot - currentSlot()) % 7;
  }

  function setMinimumBalance(uint256 newBalance) external onlyAdmin {
    require(newBalance >= 100_000 && newBalance <= 500_000, "Value invalid");
    newBalance = (newBalance * 1 ether);
    require(newBalance != minimumBalance, "Value unchanged");
    require(minimumBalance > newBalance, "Value cannot increase");

    if (!isConfirmed(2)) return;

    emit MinimumBalanceChanged(minimumBalance, newBalance);
    minimumBalance = newBalance;
  }

  function setSlot(uint256 slot, address key) public onlyAdmin {
    require(slot>=0 && slot <= slots, "Value invalid");
    require(slot>0 || slots < MAX_SLOTS, "All slots filled");
    require(token[key].added>0, "Token not found");

    if (slot==0) {
      slots++;
      slot = slots;
    }
    tokenInSlot[slot] = key;
    emit SlotSet(slot, key, ERC20(key).name());
  }

  function setSlots(address[] memory keys) external onlyAdmin {
    require(keys.length > 0 && keys.length < MAX_SLOTS, "Too many values");
    for (uint256 idx=0; idx<keys.length; idx++) require(token[keys[idx]].added>0, "Token not found");

    for (uint256 idx=1; idx<=slots; idx++) delete tokenInSlot[idx];
    slots = 0;
    for (uint256 idx=0; idx<keys.length; idx++) setSlot(0, keys[idx]);
  }

  function setStaking(bool setting) external onlyAdmin {
    require(isStakingOn!=setting, "Value unchanged");

    if (!isConfirmed(2)) return;

    isStakingOn = setting;
    emit StakingChanged(!setting, setting);
  }

  function setWaitingPeriod(uint256 inSeconds) external onlyAdmin {
    require(inSeconds != waitingPeriod, "Value unchanged");
    require(inSeconds >= 1 hours && inSeconds <= 1 days, "Value invalid");

    if (!isConfirmed(2)) return;

    emit WaitingPeriodChanged(waitingPeriod, inSeconds);
    waitingPeriod = inSeconds;
  }

  function trackBuy(address account, uint256 newBalance) external onlyOwner {
    if (holder[account].added==0) holder[account].added = stamp();
    holder[account].bought = stamp();
    setBalance(account, newBalance);
  }

  function trackSell(address account, uint256 newBalance) external onlyOwner {
    holder[account].sold = stamp();
    setBalance(account, newBalance);
  }

  function withdrawFunds(address payable account) public override { // EMITS EVENT
    require(getPending(account) > 0, "No funds");
    require(canClaim(holder[account].claimed), "Wait time active");

    updatedWeightedBalance(account);
    holder[account].claimed = stamp();
    super.withdrawFunds(account);
  }

  // PRIVATE

  function _transferOwnership(address newOwner) internal override {
    super._transferOwnership(newOwner);
    if (isContract(newOwner)) variegate = payable(newOwner);
  }

  function ageInDays(uint32 stamped) private view returns (uint32) {
    return ageInHours(stamped) / 24;
  }

  function ageInHours(uint32 stamped) private view returns (uint32) {
    return stamped==0 ? 0 : (stamp() - stamped) / 1 hours;
  }

  function canClaim(uint48 lastClaimTime) private view returns (bool) {
    if (lastClaimTime > block.timestamp) return false;
    return block.timestamp.sub(lastClaimTime) >= waitingPeriod;
  }

  function holderSet(address account, uint256 val) private {
    if (holder[account].index==0) {
      holders++;
      holderAt[holders] = account;
      holder[account].index = holders;
    }
    holder[account].balance = val;
  }

  function holderRemove(address account) private {
    if (holder[account].index==0) return;

    // COPY LAST ROW INTO SLOT BEING DELETED
    holder[holderAt[holders]].index = holder[account].index;
    holderAt[holder[account].index] = holderAt[holders];

    delete holderAt[holders];
    holders--;
    holder[account].index = 0;
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

  function setBalance(address account, uint256 newBalance) private {
    if (newBalance < minimumBalance || holder[account].excluded!=0) { // BELOW MIN OR EXCLUDED
      totalTracked -= holder[account].balance;
      updateBalance(account, 0);
      holderRemove(account); // REMOVE FROM ARRAY TO THIN STORAGE
      return;
    }

    if (newBalance > holder[account].balance) {
      totalTracked += newBalance.sub(holder[account].balance);
    } else if(newBalance < holder[account].balance) {
      totalTracked -= holder[account].balance.sub(newBalance);
    }

    holderSet(account, newBalance);
    putWeighted(account);

    if (getPending(account) <= 0) return; // NOTHING PENDING WE ARE DONE HERE
    // PUSH FUNDS TO ACCOUNT W/EVENT AND UPDATE CLAIMED STAMP
    holder[account].claimed = stamp();
    super.withdrawFunds(payable(account));
  }

  function stakePercent(address account) internal view returns (uint32) {
    if (!isStakingOn) return 100;
    uint32 stamped = holder[account].sold;
    if (stamped==0) stamped = holder[account].added;
    uint32 age = ageInDays(stamped);
    return (age > 50) ? 100 : 50 + age;
  }

  function stamp() private view returns (uint32) {
    return uint32(block.timestamp); // - 1231006505 seconds past BTC epoch
  }

  function pushFunds(address account) internal returns (bool) {
    if (!canClaim(holder[account].claimed) || getPending(account)==0) return false;

    super.withdrawFunds(payable(account));

    holder[account].claimed = stamp();
    return true;
  }

  function putWeighted(address account) private {
    holder[account].percent = stakePercent(account);
    updateBalance(account, weightedBalance(account));
  }

  function sendReward(address payable account, uint256 amount) internal override returns (bool) {
    if (currentSlot()==0) return super.sendReward(account, amount);

    address tkn = tokenInSlot[currentSlot()];
    IERC20 rewards = IERC20(tkn);
    uint256 before = rewards.balanceOf(account);
    address[] memory path = new address[](2);
    path[0] = uniswapV2Router.WETH();
    path[1] = tkn;

    try uniswapV2Router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amount} (0, path, address(account), block.timestamp){
      token[tkn].balance += rewards.balanceOf(account).sub(before);
      token[tkn].amount += amount;
      token[tkn].claims++;
    } catch {
      return false;
    }
    return true;
  }

  function weightedBalance(address account) internal view returns (uint256) {
    uint256 balance = holder[account].balance;
    if (!isStakingOn || balance==0 || holder[account].percent > 99) return balance;
    return balance.mul(holder[account].percent).div(100);
  }

  function updatedWeightedBalance(address account) internal {
    if (holder[account].percent==stakePercent(account)) return; // NO CHANGE
    putWeighted(account); // REWEIGHT TOKENS
  }
}
