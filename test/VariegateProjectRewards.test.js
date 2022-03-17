const VariegateProject = artifacts.require('./VariegateProject.sol');
const Variegate = artifacts.require('./Variegate.sol');

const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

var chai = require('chai');

const assert = chai.assert;

function toWei(count) {
  return `${count}000000000000000000`;
}

function fromWei(bn) {
  return (bn / toWei(1)).toFixed(2);
}

const MIN_BALANCE = 250_000;

contract('VariegateProject', function (accounts) {
  const [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8, holder9] = accounts;
  let contract;
  let token;
  let transaction;
  let shareholders = [owner, holder1, holder2, holder3, holder4, holder5, holder6, holder7, holder8];
  let dollars = [2000,2000,2000,1000,1000,500,500,500,500];
  let totalDollars = dollars.reduce((m,x)=>m+=x, 0);

  beforeEach('setup contract for each test', async function() {
    contract = await VariegateProject.new();
    await contract.setHolders(shareholders, dollars);
  });

  it('initializes shareholders using arrays', async function () {
    report = await contract.getReport();

    assert.equal(report.holderCount, shareholders.length);
    assert.equal(report.totalDollars, totalDollars);
    assert.equal(fromWei(await contract.dividendsInBNB()), (totalDollars/333).toFixed(2));
    for (let idx=0;idx<9;idx++) {
      assert.equal((await contract.balanceOf(accounts[idx])).toNumber(), dollars[idx]);
    }
  });

  it('allows holder to view report by address or index', async function () {
    report = await contract.getReportAccountAt(2);
    assert.equal(report.account, holder1);
    assert.equal(report.index, 2);

    report = await contract.getReportAccount(report.account);
    assert.equal(report.account, holder1);
    assert.equal(report.index, 2);
  });

  it('requires address or index to exist for reporting', async function () {
    await expectRevert(contract.getReportAccountAt(100), 'Value invalid');
  });

  it('distributes funds', async function () {
    await contract.send(toWei(100), { from: holder9 });

    transaction = await contract.withdrawFunds(holder1);
    expectEvent(transaction, 'FundsWithdrawn', { account: holder1, amount: toWei(2) });

    report = await contract.getReportAccount(holder1);
    assert.equal(report.shares, '2000');
    assert.equal(report.dividendsEarned, toWei(2));
    assert.equal(report.dividendsClaimed, toWei(2));
  });

  it('only distributes funds when token set and min balance met', async function () {
    token = await Variegate.new();
    await contract.setToken(token.address, { from: owner });
    await token.transfer(holder1, toWei(MIN_BALANCE), { from: owner });
    await contract.withdrawFunds(holder1); // UPDATES BALANCES

    await contract.send(toWei(100), { from: holder9 });

    report = await contract.getReportAccount(holder1);
    assert.notEqual(report.shares, '0'); // TRACKED
    assert.notEqual(report.dividendsEarned, '0');

    report = await contract.getReportAccount(holder2);
    assert.equal(report.shares, '0'); // NOT TRACKED
    assert.equal(report.dividendsEarned, '0');

    await token.transfer(holder2, toWei(MIN_BALANCE), { from: owner });
    await contract.withdrawFunds(holder2); // UPDATES BALANCES
    await contract.send(toWei(10), { from: holder9 });

    report = await contract.getReportAccount(holder2);
    assert.notEqual(report.shares, '0'); // TRACKED
    assert.notEqual(report.dividendsEarned, '0');
  });

  it('stops distributing funds after paid back', async function () {
    let complete = (await contract.dividendsInBNB()).toString() + '0'; // 10x since tax is 10%
    await contract.send(complete, { from: holder9 }); // SEND ENOUGH TO COVER COSTS
    report = await contract.getReport();
    assert.equal(fromWei(report.totalDividends), '30.03');
    report = await contract.getReportAccount(holder1);
    assert.equal(fromWei(report.dividendsEarned), '6.01'); // holder1 paid 2k so should get back about 6 BNB

    // SENDING IN MORE BNB SHOULD NO LONGER AFFECT DIVIDENDS
    await contract.send(toWei(10), { from: holder9 });
    report = await contract.getReport();
    assert.equal(fromWei(report.totalDividends), '30.03');
    report = await contract.getReportAccount(holder1);
    assert.equal(fromWei(report.dividendsEarned), '6.01');
  });

  it('processes all shareholder', async function () {
    await contract.setToken(token.address, { from: owner });
    for (let idx=1;idx<shareholders.length;idx++) {
      await token.transfer(shareholders[idx], toWei(MIN_BALANCE), { from: owner });
    }

    let complete = (await contract.dividendsInBNB()).toString() + '0';
    await contract.send(complete, { from: holder9 }); // SEND ENOUGH TO COVER COSTS
    report = await contract.getReport();
    assert.equal(fromWei(report.totalDividends), '30.03');
    report = await contract.getReportAccount(holder1);
    assert.equal(fromWei(report.dividendsEarned), '6.01'); // holder1 paid 2k so should get back about 6 BNB

    let cnt = await contract.holders();
    let sum = 0;
    for (let idx=1;idx<=cnt;idx++) {
      await contract.withdrawFunds(await contract.holderAt(idx));
      report = await contract.getReportAccountAt(idx);
      assert.equal(fromWei(report.dividendsClaimed), (30.03 / (totalDollars / dollars[idx-1])).toFixed(2));
      sum += fromWei(report.dividendsClaimed) * 1;
    }
    assert.equal(sum, 30.03);
  });
});
