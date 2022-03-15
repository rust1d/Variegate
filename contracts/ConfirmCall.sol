// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ConfirmCall is Ownable {
  struct Confirm {
    uint256 expires;
    uint256 count;
    address[] accounts;
    bytes args;
  }

  mapping (bytes4 => Confirm) public confirm;
  address[3] public admins;

  event AdminChanged(address from, address to);
  event ConfirmationComplete(address account, bytes4 method, uint256 confirmations);
  event ConfirmationRequired(address account, bytes4 method, uint256 confirmations, uint256 required);
  event FundsApproved(address to, uint256 amount);

  constructor() { }

  receive() external payable {}

  modifier OnlyAdmin() {
    require(isAdmin(msg.sender), "Caller invalid");
    _;
  }

  function isAdmin(address account) public view returns (bool) {
    for (uint idx; idx<admins.length; idx++) if (admins[idx]==account) return true;
    return (admins[0]==address(0) && account==owner()); // no admins, use owner
  }

  function confirmCall(uint256 required, address account, bytes4 method, bytes calldata args) public returns (bool) {
    require(isAdmin(account), "Caller invalid");

    if (required==1) return true;

    if (confirm[method].expires!=0 && (confirm[method].expires<block.timestamp || keccak256(confirm[method].args)!=keccak256(args))) { // existing call expired or args neq
      delete confirm[method];
    }

    bool found = false;
    for (uint idx; idx<confirm[method].accounts.length; idx++) {
      if (confirm[method].accounts[idx]==account) found = true; // check re-confirms
    }

    if (!found) confirm[method].accounts.push(account);

    if (confirm[method].accounts.length==required) { // confirmed
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

  function replaceAdmin(address from, address to) external OnlyAdmin {
    require(to!=address(0) && isAdmin(from) && !isAdmin(to), "Value invalid");

    if (!isConfirmed(2)) return;

    for (uint idx; idx<admins.length; idx++) if (admins[idx]==from) admins[idx] = to;
    emit AdminChanged(from, to);
  }

  function requestFunds(address to, uint256 amount) external OnlyAdmin {
    require(address(this).balance > amount, "Overdraft");

    if (!isConfirmed(3)) return;

    (bool success,) = payable(to).call{ value: amount, gas: 3000 }("");
    if (success) emit FundsApproved(to, amount);
  }

  function setAdmins(address[] memory accounts) external OnlyAdmin {
    require(admins[0]==address(0), "Admins already set");
    require(accounts.length==3, "3 Admins required");

    for (uint256 idx=0;idx<accounts.length;idx++) admins[idx] = accounts[idx];
  }

  // PRIVATE

  function isConfirmed(uint256 required) private returns (bool) {
    return required < 2 || confirmCall(required, msg.sender, msg.sig, msg.data);
  }
}
