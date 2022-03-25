// contracts/Odsy.sol
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.11;

import "./VariegateProject.sol";
import "./VariegateRewards.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract Variegate is ERC20, Ownable {
  using SafeMath for uint256;
  IUniswapV2Router02 public immutable uniswapV2Router;
  address public immutable uniswapV2Pair;

  address payable public rewards;
  address payable public project;

  uint256 public constant FINAL_SUPPLY = 1_000_000_000 ether;
  uint256 public constant MAX_WALLET = 15_000_000 ether; // MAX PER WALLET: 1.5%
  uint256 public constant MAX_SELL = 5_000_000 ether; // MAX PER SELL: 0.5%

  uint256 public accumulatedProject = 0;
  uint256 public accumulatedRewards = 0;
  uint256 public gasLimit = 300_000; // GAS FOR REWARDS PROCESSING
  uint256 public swapThreshold = 5_000_000 ether; // CONTRACT SWAPS TO BSD

  uint16 public constant FEE_PROJECT = 2;
  uint16 public constant FEE_TO_BUY = 8;
  uint16 public constant FEE_TO_SELL = 12;

  bool public isOpenToPublic = false;
  bool private swapping = false;

  // ADMIN CONTROL
  address[3] public admins;

  struct Confirm {
    uint256 expires;
    uint256 count;
    address[] accounts;
    bytes args;
  }
  mapping (bytes4 => Confirm) public confirm;

  // MAPPINGS
  mapping (address => bool) public autoMarketMakers; // Any transfer to these addresses are likely sells
  mapping (address => bool) public isFeeless; // exclude from all fees and maxes
  mapping (address => bool) public isPresale; // can trade in PreSale

  // EVENTS
  event FundsReceived(address indexed from, uint amount);
  event FundsSentToProject(uint256 tokens, uint256 value);
  event FundsSentToRewards(uint256 tokens, uint256 value);
  event GasLimitChanged(uint256 from, uint256 to);
  event IsFeelessChanged(address indexed account, bool excluded);
  event ProjectContractChanged(address indexed from, address indexed to);
  event RewardsContractChanged(address indexed from, address indexed to);
  event SetAutomatedMarketMakerPair(address indexed pair, bool active);
  event MarketCapCalculated(uint256 price, uint256 marketCap, uint256 tokens, uint256 value);

  event ConfirmationRequired(address account, bytes4 method, uint256 confirmations, uint256 required);
  event ConfirmationComplete(address account, bytes4 method, uint256 confirmations);
  event AdminChanged(address from, address to);

  constructor() ERC20("Variegate", "$VARI") {
    address ROUTER_PCSV2_MAINNET = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    // address ROUTER_PCSV2_TESTNET = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    // address ROUTER_FAKEPCS_TESTNET = 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3;

    IUniswapV2Router02 router = IUniswapV2Router02(ROUTER_PCSV2_MAINNET);
    address pair = IUniswapV2Factory(router.factory()).createPair(address(this), router.WETH());
    uniswapV2Router = router;
    uniswapV2Pair = pair;
    autoMarketMakers[pair] = true;
    isPresale[owner()] = true;
    isFeeless[address(this)] = true;
    project = payable(owner());
    rewards = payable(owner());

    _mint(owner(), FINAL_SUPPLY);
  }

  modifier onlyAdmin() {
    require(isAdmin(_msgSender()), "Caller invalid");
    _;
  }

  modifier onlyVariegates() {
    require(rewards==_msgSender() || project==_msgSender(), "Caller invalid");
    _;
  }

  receive() external payable {
    emit FundsReceived(msg.sender, msg.value);
  }

  function confirmCall(uint256 required, address account, bytes4 method, bytes calldata args) public onlyVariegates returns (bool) {
    require(isAdmin(account), "Caller invalid");
    return confirmed(required, account, method, args);
  }

  function isAdmin(address account) public view returns (bool) {
    for (uint idx; idx<admins.length; idx++) if (admins[idx]==account) return true;
    return (admins[0]==address(0) && account==owner()); // IF NO OFFICERS SET USE onlyOwner
  }

  function openToPublic() external onlyAdmin { // NO GOING BACK
    require(isContract(project) && isContract(rewards) && admins[0]!=address(0), "Configuration required");
    require(address(this).balance > 0, "Must have bnb to pair for launch");
    require(balanceOf(address(this)) > 0, "Must have tokens to pair for launch");

    if (!isConfirmed(2)) return;

    isOpenToPublic = true;

    // INITIAL LIQUIDITY GOES TO OWNER TO LOCK
    // addLiquidity(balanceOf(address(this)), address(this).balance);
  }

  function setAdmins(address[] memory accounts) external onlyAdmin {
    require(admins[0]==address(0), "Already set");
    require(accounts.length==3, "3 Admins required");

    for (uint256 idx=0;idx<accounts.length;idx++) admins[idx] = accounts[idx];
  }

  function setAutomatedMarketMakerPair(address pair, bool setting) external onlyAdmin {
    require(pair != uniswapV2Pair, "Value invalid");
    require(autoMarketMakers[pair] != setting, "Value unchanged");

    if (!isConfirmed(2)) return;

    autoMarketMakers[pair] = setting;
    emit SetAutomatedMarketMakerPair(pair, setting);
  }

  function setFeeless(address account, bool setting) external onlyAdmin {
    require(isFeeless[account]!=setting, "Value unchanged");

    if (!isConfirmed(2)) return;

    isFeeless[account] = setting;
    emit IsFeelessChanged(account, setting);
  }

  function setGasLimit(uint256 gas) external onlyAdmin {
    require(gas >= 250_000 && gas <= 750_000, "Value invalid");
    require(gas != gasLimit, "Value unchanged");

    if (!isConfirmed(2)) return;

    emit GasLimitChanged(gasLimit, gas);
    gasLimit = gas;
  }

  function setPresale(address account, bool setting) external onlyAdmin {
    if (!isConfirmed(2)) return;

    isPresale[account] = setting;
  }

  function setProjectContract(address newContract) external onlyAdmin {
    require(newContract != project, "Value unchanged");
    require(isContract(newContract), "Not a contract");
    require(Ownable(newContract).owner() == address(this), "Token must own project");

    if (!isConfirmed(3)) return;

    if (isContract(project)) VariegateProject(project).transferOwnership(owner());
    emit ProjectContractChanged(project, newContract);
    project = payable(newContract);
  }

  function setRewardsContract(address newContract) external onlyAdmin {
    require(newContract != rewards, "Value unchanged");
    require(isContract(newContract), "Not a contract");
    require(Ownable(newContract).owner() == address(this), "Token must own tracker");

    if (!isConfirmed(3)) return;

    if (isContract(rewards)) VariegateRewards(rewards).transferOwnership(owner());
    emit RewardsContractChanged(rewards, newContract);
    rewards = payable(newContract);
  }

  function replaceAdmin(address from, address to) external onlyAdmin {
    require(to!=address(0) && isAdmin(from) && !isAdmin(to), "Value invalid");

    if (!isConfirmed(2)) return;

    for (uint idx; idx<admins.length; idx++) if (admins[idx]==from) admins[idx] = to;
    emit AdminChanged(from, to);
  }

  // PRIVATE

  function _transfer(address from, address to, uint256 amount) internal override {
    require(from != address(0) && to != address(0), "Value invalid");
    require(amount > 0, "Value invalid");

    require(to==address(this) || autoMarketMakers[to] || balanceOf(to).add(amount) <= MAX_WALLET, "Wallet over limit");

    if (!isOpenToPublic && isPresale[from]) { // PRE-SALE WALLET - NO FEES, JUST TRANSFER AND UPDATE TRACKER BALANCES
      transferAndUpdateRewardsTracker(from, to, amount);
      return;
    }

    require(isOpenToPublic, "Trading closed");

    if (!autoMarketMakers[to] && !autoMarketMakers[from]) { // NOT A SALE, NO FEE TRANSFER
      transferAndUpdateRewardsTracker(from, to, amount);
      processSomeClaims();
      return; // NO TAXES
    }

    if (!swapping) {
      bool feePayer = !isFeeless[from] && !isFeeless[to];
      if (feePayer) {
        uint256 taxTotal = 0;
        uint256 taxProject = 0;
        uint256 taxRewards = 0;
        if (autoMarketMakers[to] && from!=address(uniswapV2Router)) { // SELL
          require(amount <= MAX_SELL, "Sell over limit");
          taxTotal = amount.mul(FEE_TO_SELL).div(100);
          taxProject = taxTotal.mul(FEE_PROJECT).div(FEE_TO_SELL);
        } else { // BUY
          taxTotal = amount.mul(FEE_TO_BUY).div(100);
          taxProject = taxTotal.mul(FEE_PROJECT).div(FEE_TO_BUY);
        }
        if (taxTotal > 0) {
          taxRewards = taxTotal.sub(taxProject);
          accumulatedProject += taxProject;
          accumulatedRewards += taxRewards;
          super._transfer(from, address(this), taxTotal);
          amount -= taxTotal;
        }
      }

      if (!autoMarketMakers[from]) {
        swapping = true;
        if (balanceOf(address(this)) >= swapThreshold) swapAndSendToRewards(swapThreshold);
        if (balanceOf(address(this)) >= swapThreshold) swapAndSendToProject(swapThreshold);
        swapping = false;
      }
    }

    transferAndUpdateRewardsTracker(from, to, amount);

    if (!swapping) {
      processSomeClaims();
    }
  }

  function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
    _approve(address(this), address(uniswapV2Router), tokenAmount);
    uniswapV2Router.addLiquidityETH{value: ethAmount}(address(this), tokenAmount, 0, 0, payable(owner()), block.timestamp);
  }

  function changeMarketCap(uint256 swappedETH, uint256 tokens) private {
    uint256 marketCap = swappedETH.mul(FINAL_SUPPLY).div(tokens).div(1 ether);
    uint256 price = marketCap.mul(1 ether).div(FINAL_SUPPLY.div(1 ether));
    emit MarketCapCalculated(price, marketCap, tokens, swappedETH); // TESTING
    // TODO SET swapThreshold
    // swapThreshold = uint256((17-level)) * 1_000_000 ether;
  }

  function confirmed(uint256 required, address account, bytes4 method, bytes calldata args) internal returns (bool) {
    if (required==1) return true;

    if (confirm[method].expires!=0 && (confirm[method].expires<block.timestamp || keccak256(confirm[method].args)!=keccak256(args))) { // EXISTING CALL EXPIRED OR ARGS NEQ
      delete confirm[method];
    }

    bool found = false;
    for (uint idx; idx<confirm[method].accounts.length; idx++) if (confirm[method].accounts[idx]==account) found = true; // CHECK RE-CONFIRMS

    if (!found) confirm[method].accounts.push(account);

    if (confirm[method].accounts.length==required) { // CONFIRMED
      emit ConfirmationComplete(account, method, required);
      delete confirm[method];
      return true;
    }

    confirm[method].count = confirm[method].accounts.length;
    confirm[method].args = args;
    confirm[method].expires = block.timestamp + 60 * 15;
    emit ConfirmationRequired(account, method, confirm[method].count, required);

    return false;
  }

  function isConfirmed(uint256 required) private returns (bool) {
    return required < 2 || admins[0]==address(0) || confirmed(required, msg.sender, msg.sig, msg.data);
  }

  function isContract(address key) private view returns (bool) {
    return key.code.length > 0;
  }

  function processSomeClaims() private {
    if (!isContract(rewards)) return;

    try VariegateRewards(rewards).processClaims(gasLimit) {} catch {}
  }

  function swapAndSendToRewards(uint256 tokens) private {
    if (accumulatedRewards < tokens) return; // NOT YET

    accumulatedRewards -= tokens;
    uint256 swappedETH = swapTokensForETH(tokens);
    if (swappedETH > 0) {
      (bool success,) = rewards.call{value: swappedETH}("");
      if (success) {
        emit FundsSentToRewards(tokens, swappedETH);
        changeMarketCap(swappedETH, tokens);
      }
    }
  }

  function swapAndSendToProject(uint256 tokens) private {
    if (accumulatedProject < tokens) return; // NOT YET

    accumulatedProject -= tokens;
    uint256 swappedETH = swapTokensForETH(tokens);
    if (swappedETH > 0) {
      (bool success,) = project.call{value: swappedETH}("");
      if (success) emit FundsSentToProject(tokens, swappedETH);
    }
  }

  function swapTokensForETH(uint256 tokens) private returns(uint256) {
    address[] memory pair = new address[](2);
    pair[0] = address(this);
    pair[1] = uniswapV2Router.WETH();
    _approve(address(this), address(uniswapV2Router), tokens);
    uint256 currentETH = address(this).balance;
    uniswapV2Router.swapExactTokensForETH(tokens, 0, pair, address(this), block.timestamp);
    return address(this).balance.sub(currentETH);
  }

  function transferAndUpdateRewardsTracker(address from, address to, uint256 amount) private {
    super._transfer(from, to, amount);

    if (!isContract(rewards)) return;

    try VariegateRewards(rewards).trackSell(from, balanceOf(from)) {} catch {}
    try VariegateRewards(rewards).trackBuy(to, balanceOf(to)) {} catch {}
  }
}
