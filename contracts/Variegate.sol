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

  // address public variRewards;
  // address public variProject;
  VariegateRewards public rewards;
  VariegateProject public project;

  uint256 public constant FINAL_SUPPLY = 1_000_000_000 ether;
  uint256 public constant MAX_WALLET = 15_000_000 ether; // MAX PER WALLET: 1.5%
  uint256 public constant MAX_SELL = 5_000_000 ether; // MAX PER SELL: 0.5%

  bool public isOpenToPublic = false;
  uint256 public accumulatedRewards = 0;
  uint256 public accumulatedProject = 0;
  uint16 public feeToBuy = 8;
  uint16 public feeToSell = 12;
  uint16 public feeProject = 2;

  uint256 public swapThreshold = 5_000_000 ether; // CONTRACT SWAPS TO BSD
  uint256 public gasLimit = 300_000; // GAS FOR REWARDS PROCESSING

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

  // INTERNAL VARS
  bool private swapping = false;

  // INITIALIZE CONTRACT
  constructor() ERC20("Variegate", "$VARI") {
    // SETUP PANCAKESWAP
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

    _mint(owner(), FINAL_SUPPLY);
  }

  modifier onlyAdmin() {
    require(isAdmin(_msgSender()), "Caller invalid");
    _;
  }

  receive() external payable {
    emit FundsReceived(msg.sender, msg.value);
  }

  // function test(address account, uint256 amount) public returns(uint256 expires, uint256 count, bytes memory args) {
  //   // return abi.encode(msg.sig, msg.data);
  //   project.confirmCall(msg.sender, msg.sig, msg.data);

  //   (expires, count, args) = project.confirm(msg.sig);
  // }

  // function detest(bytes calldata data) public pure returns(bytes memory args, bytes4 sigg) { //
  //    (sigg, args) = abi.decode(data, (bytes4, bytes));

  //   // sigg = msg.sig;
  //   // (funct, account, amount) = abi.decode(data, (uint256, address, uint256));
  //   // (sigg, account, amount) = abi.decode(args, (bytes4, address, uint256));
  // }

  function isAdmin(address account) public view returns(bool) {
    return (!isContract(address(project)) && account==owner()) || (isContract(address(project)) && project.isAdmin(account));
  }

  function openToPublic() external onlyAdmin { // NO GOING BACK
    require(isContract(address(project)) && isContract(address(rewards)), "Configuration required");
    require(address(this).balance > 0, "Must have bnb to pair for launch");
    require(balanceOf(address(this)) > 0, "Must have tokens to pair for launch");

    isOpenToPublic = true;

    // INITIAL LIQUIDITY GOES TO OWNER TO LOCK
    // addLiquidity(balanceOf(address(this)), address(this).balance);
  }

  function setAutomatedMarketMakerPair(address pair, bool value) external onlyAdmin {
    require(pair != uniswapV2Pair, "Value invalid");
    require(autoMarketMakers[pair] != value, "Value unchanged");
    autoMarketMakers[pair] = value;
    emit SetAutomatedMarketMakerPair(pair, value);
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
    emit GasLimitChanged(gasLimit, gas);
    gasLimit = gas;
  }

  function setPresale(address account, bool setting) external onlyAdmin {
    isPresale[account] = setting;
  }

  function setProjectContract(address newContract) external onlyAdmin {
    require(newContract != address(project), "Value unchanged");
    require(isContract(newContract), "Not a contract");

    emit ProjectContractChanged(address(project), newContract);
    project = VariegateProject(payable(newContract));
  }

  function setRewardsContract(address newContract) external onlyAdmin {
    require(newContract != address(rewards), "Value unchanged");
    require(isContract(newContract), "Not a contract");
    require(Ownable(newContract).owner() == address(this), "Token must own tracker");

    emit RewardsContractChanged(address(rewards), newContract);
    rewards = VariegateRewards(payable(newContract));
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
          taxTotal = amount.mul(feeToSell).div(100);
          taxProject = taxTotal.mul(feeProject).div(feeToSell);
        } else { // BUY
          taxTotal = amount.mul(feeToBuy).div(100);
          taxProject = taxTotal.mul(feeProject).div(feeToBuy);
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

  function isConfirmed(uint256 required) private returns (bool) {
    return !isContract(address(project)) || required < 2 || project.confirmCall(required, msg.sender, msg.sig, msg.data);
  }

  function isContract(address key) private view returns (bool) {
    return key.code.length > 0;
  }

  function processSomeClaims() private {
    if (!isContract(address(rewards))) return;

    try rewards.processClaims(gasLimit) {} catch {}
  }

  function swapAndSendToRewards(uint256 tokens) private {
    if (accumulatedRewards < tokens) return; // NOT YET

    accumulatedRewards -= tokens;
    uint256 swappedETH = swapTokensForETH(tokens);
    if (swappedETH > 0) {
      (bool success,) = address(rewards).call{value: swappedETH}("");
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
      (bool success,) = address(project).call{value: swappedETH}("");
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

    if (!isContract(address(rewards))) return;

    try rewards.trackSell(from, balanceOf(from)) {} catch {}
    try rewards.trackBuy(to, balanceOf(to)) {} catch {}
  }
}
