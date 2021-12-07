import './App.css';
import React, { useState } from 'react'
import { Transaction, TransactionWitnessSet, Address, TransactionUnspentOutput } from '@emurgo/cardano-serialization-lib-asmjs'
import { Buffer } from 'buffer/'

const hexToBytes = (hex) => Buffer.from(hex, "hex");
const bytesToHex = (bytes) => Buffer.from(bytes).toString("hex");
const utxoFromHex = (hex) => TransactionUnspentOutput.from_bytes(hexToBytes(hex));
const getTxId  = (utxo) => bytesToHex(utxo.input().transaction_id().to_bytes());
const getTxIndex = (utxo) => utxo.input().index();

const connect = (setState) => {
  console.log('cardano object', window.cardano)
  window.cardano.enable()
    .then(api => {
      console.log("enabled!", api)
      // 'api' should have these methods, it appears nami glues these methods to
      // the 'cardano' object after activation,deviating from the current
      // version of the spec
      return window.cardano.getUsedAddresses()
    }).then(addrs => {
      // addrs is an array-like object containing CBOR encoded addresses
      // might decode using https://github.com/kriszyp/cbor-x 
      console.log("addresses returned", addrs)
      setState({ address: addrs[0] })
      console.log("done")
      return addrs[0]
    })
    .then(addr => {
      const sendingAddress = Address.from_bytes(hexToBytes(addr), "hex").to_bech32()
      console.log(sendingAddress)
      const data = 
        {
          caID: {
            contents: {
              ownAddress: sendingAddress
            },
            tag: 'LockSpend'
          }
        }
      
      console.log("Activation JSON: ", data)
      return fetch("http://localhost:9080/api/contract/activate",
        {
          method: "POST",
          headers: { "Content-type": "application/json" },
          // mode: 'cors',
          body: JSON.stringify(data)
        })
    })
    .then(response => response.json())
    .then(data => {
      console.log("Data: ", data)
      setState({ contractInstance: data.unContractInstanceId })
    })
    .catch(err => console.log("Error: ", err))
}


const callLock = (inst) => {
  window.cardano.getCollateral()
    .then(utxos => {
      console.log("Collateral: ", utxos)
      const cUtxo = utxoFromHex(utxos[0])
      const hardcodedAmt = 11000000 

      const data = {
        lovelaceAmount: hardcodedAmt,
        collateralRef: {
            txOutRefId: {
                getTxId: getTxId(cUtxo)
                },
            txOutRefIdx: getTxIndex(cUtxo)
        }
      }
      console.log("Endpoint req: ", data)
      fetch(`http://localhost:9080/api/contract/instance/${inst}/endpoint/lock`,
        {
          method: "POST",
          headers: { "Content-type": "application/json" },
          body: JSON.stringify(data)
        }
      ).then(res => console.log("Endpoint call res: ", res))
      .then(() => getAndSingSubmit(inst))
      .catch(err => console.log(err))
    }
    )
    .then(res => console.log(res))
    .catch(err => console.log(err))
}

const getAndSingSubmit = (contractInstance) => {
  console.log("Contract instance: ", contractInstance)
  setTimeout(() => {
    fetch(`http://localhost:9080/api/contract/instance/${contractInstance}/status`)
    .then(response => response.json())
    .then(contractState => {
      console.log("Contract state: ", contractState)
      const cbor = contractState.cicYieldedExportTxs[0].transaction
      console.log("CBOR: ", cbor)
      return cbor
    })
    .then(cbor => signSubmit(cbor))
    .catch(err => console.log(err))
  },
  3000
  )
}


const submit = (tx, wits) => {
  const txn = Transaction.from_bytes(Buffer.from(tx, 'hex'))
  // console.log('Tx is valid: ', txn.is_valid())
  const witnessSet = TransactionWitnessSet.from_bytes(Buffer.from(wits, 'hex'))
  const signedTx = Transaction.new(txn.body(), witnessSet)
  window.cardano.submitTx(Buffer.from(signedTx.to_bytes()).toString('hex'))
    .then(res => console.log("Submitted!"))
    .catch(err => console.log("Submission error: ", err))
}

const sign = (tx) => {
  console.log("sign txn")
  window.cardano.signTx(tx)
    .then(res => console.log("Signed!"))
    .catch(err => console.log("error: ", err))
}

const signSubmit = (tx) => {
  console.log("sign txn")
  window.cardano.signTx(tx)
    .then(witness => {
      console.log("Sign witness: ", witness)
      submit(tx, witness)
    })
    .catch(err => console.log("error: ", err))
}


const debg = () => {
  window.cardano.getUtxos()
    .then(walletUtxos => console.log("Wallet utxos: ", getTxId(utxoFromHex(walletUtxos[0]))))
    .catch(err => console.log("Error getting wallet utxos: ", err))

  fetch('http://localhost:9080/api/contract/definitions')
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(err => console.log("Error getting definitions: ", err));
}


const App = () => {
  const [state, setState] = useState({ address: "", contractInstance: "" });
  console.log("state", state)
  return (
    <div className="App">
      <button onClick={() => connect(setState)}>
        Click to activate Nami Wallet
      </button>
      <button onClick={() => callLock(state.contractInstance)}>
        Lock
      </button>
      <button onClick={() => sign("84a500818258201a792b902507dc793e54683beeefac4c6341ab2d3900801e94801b1ab96ff399000d81825820513aefa8cce5435985cef0795a96cbbd3937fce77ad1ed715ce6df77a15fe27f000182825839005feb72668e5a4effd3b34088aa56e7d558f75afe4798b8364a739673700e4b6993cbc5e612f8770aa531243b3d888a81c0a46de5fa5f6a701a38603f0383581d70719ed02924d3a1656481f02af2adbdc229d14778b718e928695638d41a00a7d8c05820ff6191af0d39df3e972d56ecd3610316ff0ce4b1ab65a336a9adfea25c8aa3bc021a001e84800e80a0f5f6")}>
        Sign hardcoded
      </button>
      <button onClick={() => debg(setState)}>
        Debug Definitions
      </button>
      <div>Address: {state.address} </div>
    </div>
  );
}

export default App;
