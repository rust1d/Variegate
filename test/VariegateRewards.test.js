// test/Odyssey.test.js
const VariegateRewards = artifacts.require('./VariegateRewards.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const assert = chai.assert;
const expect = chai.expect;

let minBalance;

const one_hour = 60 * 60;
const six_hours = 6 * one_hour;
const two_hours = 2 * one_hour;
const one_day = 24 * one_hour;

function toWei(count) {
  return `${count}000000000000000000`;
}

function fromWei(bn) {
  return (bn / toWei(1)).toFixed(2);
}

function findEvent(transaction, event) {
  for (const log of transaction.logs) if (log.event==event) return log;
  return {};
}

function eventArgs(transaction, name) {
  return findEvent(transaction, name).args;
}

function timeTravel(addSeconds) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [ addSeconds ],
      id
    }, (err1) => {
      if (err1) return reject(err1);

      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1
      }, (err2, res) => (err2 ? reject(err2) : resolve(res)));
    });
  });
}

contract('VariegateRewards', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let contract;
  let transaction;

  beforeEach('setup contract for each test', async function() {
    contract = await VariegateRewards.new();
    minBalance = fromWei(await contract.minimumBalance());
  });

  it('has a waiting period between reward claims', async function () {
    assert.equal(await contract.waitingPeriod(), six_hours);
  });

  it('allows only project to set waiting period', async function () {
    await expectRevert(contract.setWaitingPeriod(two_hours, { from: holder1 }), 'Caller invalid');
  });

  it('allows owner to set waiting period', async function () {
    transaction = await contract.setWaitingPeriod(two_hours, { from: owner });
    expectEvent(transaction, 'WaitingPeriodChanged', { from: six_hours.toString(), to: two_hours.toString() });
    assert.equal(await contract.waitingPeriod(), two_hours);
  });

  it('requires the value of WaitingPeriod to change if updated', async function () {
    await expectRevert(contract.setWaitingPeriod(six_hours, { from: owner }), "Value unchanged");
  });

  it('requires waiting period betweeen 1 hour to 1 day', async function () {
    await expectRevert(contract.setWaitingPeriod(one_hour - 1, { from: owner }), 'Value invalid');
    await expectRevert(contract.setWaitingPeriod(one_day + 1, { from: owner }), 'Value invalid');
  });

  it('allows holders to withdraw once per wait period', async function () {
    await contract.trackBuy(holder1, toWei(10_000_000), { from: owner });
    await contract.send(toWei(1), { from: owner });
    transaction = await contract.withdrawFunds(holder1);
    expectEvent(transaction, 'FundsWithdrawn', { account: holder1 });
    await contract.send(toWei(1), { from: owner });
    await expectRevert(contract.withdrawFunds(holder1), 'Wait time active');
    await timeTravel(six_hours);
    transaction = await contract.withdrawFunds(holder1);
    expectEvent(transaction, 'FundsWithdrawn', { account: holder1 });
  });

  it('has a minimum balance to earn rewards', async function () {
    assert.notEqual(await contract.minimumBalance(), '0');
  });

  it('allows only project to set minimum balance', async function () {
    await expectRevert(contract.setMinimumBalance(500_000, { from: holder1 }), 'Caller invalid');
  });

  it('allows owner to set minimum balance', async function () {
    transaction = await contract.setMinimumBalance(333333, { from: owner });
    expectEvent(transaction, 'MinimumBalanceChanged');
    assert.equal(fromWei(await contract.minimumBalance()), 333333);
  });

  it('requires the value of MinimumBalance to change if updated', async function () {
    await expectRevert(contract.setMinimumBalance(500_000, { from: owner }), "Value unchanged");
  });

  it('allows only owner to set balance of an account', async function () {
    await expectRevert(contract.trackBuy(holder1, 10_000_000, { from: holder1 }), 'Ownable: caller is not the owner');
    await expectRevert(contract.trackSell(holder1, 10_000_000, { from: holder1 }), 'Ownable: caller is not the owner');
  });

  it('allows token to set balance of an account', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    expect(await contract.balanceOf(holder1)).to.be.a.bignumber.equal(toWei(500_000));
  });

  it('requires balance of an account to be above minimum', async function () {
    await contract.trackBuy(holder1, toWei(1_000), { from: owner });
    expect(await contract.balanceOf(holder1)).to.be.a.bignumber.equal('0');
  });

  it('tracks accounts that are over minimum balance', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    assert.equal(await contract.holders(), 1);
  });

  it('does not track accounts under minimum balance', async function () {
    await contract.trackBuy(holder1, toWei(1_000), { from: owner });
    assert.equal(await contract.holders(), 0);
  });

  it('stops tracking accounts that fall under minimum balance', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    assert.equal(await contract.holders(), 1);
    await contract.trackSell(holder1, toWei(1_000), { from: owner });
    assert.equal(await contract.holders(), 0);
  });

  it('sums totalsTracked and matches rewards balance', async function () {
    await contract.trackBuy(holder1, toWei(1 * 500_000), { from: owner });
    await contract.trackBuy(holder2, toWei(2 * 500_000), { from: owner });
    await contract.trackBuy(holder3, toWei(3 * 500_000), { from: owner });
    assert.equal(await contract.totalTracked(), toWei(6 * 500_000));
    assert.equal(await contract.totalBalance(), toWei(6 * 500_000));
  });

  it('totals amounts tracked and completely removes when under max', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    await contract.trackBuy(holder2, toWei(500_000), { from: owner });
    await contract.trackSell(holder1, toWei(100_000), { from: owner });
    assert.equal(await contract.totalTracked(), toWei(500_000));
  });

  it('totals amounts tracked and correctly adjusts when balance changes', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    assert.equal(await contract.totalTracked(), toWei(500_000));
    await contract.trackBuy(holder1, toWei(1.5 * 500_000), { from: owner });
    assert.equal(await contract.totalTracked(), toWei(1.5 * 500_000));
    await contract.trackSell(holder1, toWei(100_000), { from: owner });
    assert.equal(await contract.totalTracked(), '0');
  });

  it('allows tracker settings to be read', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    await contract.send(toWei(2), { from: holder4 });
    let data = await contract.getReport();
    assert.equal(data.holderCount, 1);
    assert.isFalse(data.stakingOn);
    assert.equal(data.totalTokensTracked, toWei(500_000));
    assert.equal(data.totalTokensStaked, toWei(500_000));
    assert.equal(data.totalRewardsPaid, toWei(2));
    assert.equal(data.requiredBalance, toWei(500_000));
    assert.equal(data.waitPeriodSeconds, six_hours);
  });

  it('requires index to exist for reporting', async function () {
    await expectRevert(contract.getReportAccountAt(9), 'Value invalid');
  });

  it('allows holder to view report by address or index', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    await contract.trackBuy(holder2, toWei(500_000), { from: owner });

    let report = await contract.getReportAccount(holder2);
    assert.equal(report.account, holder2);
    assert.equal(report.index, '2');

    report = await contract.getReportAccountAt(2);
    assert.equal(report.account, holder2);
    assert.equal(report.index, '2');
  });

  it('allows holder to view an account status report', async function () {
    await contract.trackBuy(holder1, toWei(500_000), { from: owner });
    await contract.trackBuy(holder2, toWei(500_000), { from: owner });
    await contract.send(toWei(2), { from: holder3 });
    await contract.withdrawFunds(holder1);
    let data = await contract.getReportAccount(holder1);
    assert.equal(data.index, '1');
    assert.equal(data.balance, toWei(500_000));
    assert.equal(data.stakedPercent, '100');
    assert.equal(data.stakedTokens, toWei(500_000));
    assert.equal(data.rewardsClaimed.toString(), toWei(1)-1); // rounding
    assert.equal(fromWei(data.rewardsEarned), fromWei(data.rewardsClaimed));
    assert.equal(data.claimHours, '0');
  });

  it('requires a valid holder to view an account status report', async function () {
    await expectRevert(contract.getReportAccount(holder1), 'Value invalid');
  });

  it('allows holder withdraw earned rewards', async function () {
    await contract.putBalance(holder1, 1, { from: owner });
    await contract.send(toWei(1), { from: holder1 });
    transaction = await contract.withdrawFunds(holder1);
    expectEvent(transaction, 'FundsWithdrawn', { account: holder1, amount: toWei(1) });
  });

  it('properly bulk processes holders using index', async function () {
    // await contract.setMinimumBalance(1, { from: owner });
    await contract.trackBuy(holder1, toWei(10 * 500_000), { from: owner });
    await contract.trackBuy(holder2, toWei(15 * 500_000), { from: owner });
    await contract.trackBuy(holder3, toWei(25 * 500_000), { from: owner });
    await contract.trackBuy(holder4, toWei(11 * 500_000), { from: owner });
    await contract.trackBuy(holder5, toWei(22 * 500_000), { from: owner });
    await contract.trackBuy(holder6, toWei(17 * 500_000), { from: owner });

    assert.equal(await contract.holders(), 6);
    assert.equal(await contract.totalBalance(), toWei(100 * 500_000));
    assert.equal(await contract.currentHolder(), 0);

    let before = [
      await web3.eth.getBalance(holder1),
      await web3.eth.getBalance(holder2),
      await web3.eth.getBalance(holder3),
      await web3.eth.getBalance(holder4),
      await web3.eth.getBalance(holder5),
      await web3.eth.getBalance(holder6)
    ];

    await contract.send(toWei(25), { from: owner });
    await contract.send(toWei(25), { from: holder7 });
    await contract.send(toWei(25), { from: holder8 });
    await contract.send(toWei(25), { from: holder9 });


    transaction = await contract.processClaims(750_000);

    let after = [
      await web3.eth.getBalance(holder1),
      await web3.eth.getBalance(holder2),
      await web3.eth.getBalance(holder3),
      await web3.eth.getBalance(holder4),
      await web3.eth.getBalance(holder5),
      await web3.eth.getBalance(holder6)
    ];

    after[0] = fromWei(after[0] - before[0]);
    after[1] = fromWei(after[1] - before[1]);
    after[2] = fromWei(after[2] - before[2]);
    after[3] = fromWei(after[3] - before[3]);
    after[4] = fromWei(after[4] - before[4]);
    after[5] = fromWei(after[5] - before[5]);

    console.log(after);

    assert.equal(after[0], 10);
    // expectEvent(transaction, 'FundsWithdrawn', { account: holder1, amount: toWei(10) });
    assert.equal(after[1], 15);
    // expectEvent(transaction, 'FundsWithdrawn', { account: holder2, amount: toWei(15) });
    assert.equal(after[2], 25);
    // expectEvent(transaction, 'FundsWithdrawn', { account: holder3, amount: toWei(25) });
    assert.equal(after[3], 11);
    // expectEvent(transaction, 'FundsWithdrawn', { account: holder4, amount: toWei(11) });
    assert.equal(after[4], 22);
    // expectEvent(transaction, 'FundsWithdrawn', { account: holder5, amount: toWei(22) });
    assert.equal(after[5], 17);
    // expectEvent(transaction, 'FundsWithdrawn', { account: holder6, amount: toWei(17) });
  });
});
