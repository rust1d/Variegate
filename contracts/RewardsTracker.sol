// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./SafeMathInt.sol";
import "./SafeMathUint.sol";

contract RewardsTracker is Ownable {
  using SafeMath for uint256;
  using SafeMathUint for uint256;
  using SafeMathInt for int256;

  uint256 public totalBalance = 0;
  uint256 public totalDistributed = 0;
  uint256 internal magnifiedBalance;
  uint256 constant internal MAGNIFIER = 2**128;

  mapping(address => uint256) public balanceOf;
  mapping(address => int256) internal magnifiedCorrections;
  mapping(address => uint256) internal withdrawnRewards;

  event FundsDeposited(address indexed from, uint amount);
  event FundsWithdrawn(address indexed account, uint amount);

  constructor() { }

  receive() external payable {
    require(msg.value > 0, "No funds sent");
    require(totalBalance > 0, "No balances tracked");

    distributeFunds(msg.value);
    emit FundsDeposited(msg.sender, msg.value);
  }

  function getAccumulated(address account) public view returns(uint256) {
    return magnifiedBalance.mul(balanceOf[account]).toInt256Safe().add(magnifiedCorrections[account]).toUint256Safe() / MAGNIFIER;
  }

  function getPending(address account) public view returns(uint256) {
    return getAccumulated(account).sub(withdrawnRewards[account]);
  }

  function getWithdrawn(address account) external view returns(uint256) {
    return withdrawnRewards[account];
  }

  function putBalance(address account, uint256 newBalance) public virtual onlyOwner {
    uint256 currentBalance = balanceOf[account];
    balanceOf[account] = newBalance;
    if (newBalance > currentBalance) {
      uint256 increaseAmount = newBalance.sub(currentBalance);
      increaseBalance(account, increaseAmount);
      totalBalance += increaseAmount;
    } else if(newBalance < currentBalance) {
      uint256 reduceAmount = currentBalance.sub(newBalance);
      decreaseBalance(account, reduceAmount);
      totalBalance -= reduceAmount;
    }
  }

  function withdrawFunds(address payable account) public virtual {
    uint256 amount = processWithdraw(account);
    if (amount > 0) emit FundsWithdrawn(account, amount);
  }

  // PRIVATE

  function decreaseBalance(address account, uint256 amount) internal {
    magnifiedCorrections[account] = magnifiedCorrections[account].add((magnifiedBalance.mul(amount)).toInt256Safe());
  }

  function distributeFunds(uint256 amount) internal virtual {
    if (totalBalance > 0 && amount > 0) {
      magnifiedBalance = magnifiedBalance.add((amount).mul(MAGNIFIER) / totalBalance);
      totalDistributed = totalDistributed.add(amount);
    }
  }

  function increaseBalance(address account, uint256 amount) internal {
    magnifiedCorrections[account] = magnifiedCorrections[account].sub((magnifiedBalance.mul(amount)).toInt256Safe());
  }

  function processWithdraw(address payable account) internal returns (uint256) {
    uint256 amount = getPending(account);
    if (amount <= 0) return 0;
    withdrawnRewards[account] = withdrawnRewards[account].add(amount);

    if (sendReward(account, amount)) return amount;

    withdrawnRewards[account] = withdrawnRewards[account].sub(amount);
    return 0;
  }

  function sendReward(address payable account, uint256 amount) internal virtual returns (bool) {
    (bool success,) = account.call{value: amount, gas: 3000}("");
    return success;
  }
}
