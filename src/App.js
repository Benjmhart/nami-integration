import './App.css';
import React, { useState } from 'react'
import { Transaction, TransactionWitnessSet, PlutusScripts, PlutusList,NativeScripts, Address, TransactionUnspentOutput, Vkeywitnesses, Redeemers } from '@emurgo/cardano-serialization-lib-asmjs'
import { Buffer } from 'buffer/'

const hexToBytes = (hex) => Buffer.from(hex, "hex");
const bytesToHex = (bytes) => Buffer.from(bytes).toString("hex");
const utxoFromHex = (hex) => TransactionUnspentOutput.from_bytes(hexToBytes(hex));
const getTxId = (utxo) => bytesToHex(utxo.input().transaction_id().to_bytes());
const getTxIndex = (utxo) => utxo.input().index();

const hexUtxoToOutRef = (hex) => {
  const utxo = utxoFromHex(hex)
  return {
    txOutRefId: {
      getTxId: getTxId(utxo)
    },
    txOutRefIdx: getTxIndex(utxo)
  }
}

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
    // -------------
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
    // ---------
    .catch(err => console.log("Error: ", err))
}


const callLock = (inst) => {
  window.cardano.getCollateral()
    .then(utxos => {
      console.log("Collateral: ", utxos)
      const hardcodedAmt = 12000000

      window.cardano.getUtxos()
        .then(walletUtxos => {
          const data = {
            lovelaceAmount: hardcodedAmt,
            collateralRef: hexUtxoToOutRef(utxos[0]),
            spendableUtxos: walletUtxos.map(utxo => hexUtxoToOutRef(utxo))
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

        })

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

const signSubmit = (tx) => {
  console.log("sign txn")
  window.cardano.signTx(tx)
    .then(witness => {
      console.log("Sign witness: ", witness)
      submit(tx, witness)
    })
    .catch(err => console.log("error: ", err))
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

const dhc = (txCbor) => {
  console.log("Before: ", txCbor)
  const backendTx = Transaction.from_bytes(Buffer.from(txCbor, 'hex'))
  const backendTxWitnessSet = backendTx.witness_set()
  console.log("Backend WS keys: ", backendTxWitnessSet.vkeys())
  console.log("Backend WS dats: ", backendTxWitnessSet.plutus_data())

  window.cardano.signTx(txCbor)
    .then(namiWitnessSetHex => {
      const namiWitnessSet = TransactionWitnessSet.from_bytes(Buffer.from(namiWitnessSetHex, 'hex'))
      console.log("WS signed: ", namiWitnessSet)

      console.log("native before: ", namiWitnessSet.native_scripts())
      if (backendTxWitnessSet.native_scripts()) {
        console.log("Setting nat-scripts: ", backendTxWitnessSet.native_scripts())
        namiWitnessSet.set_native_scripts(
          NativeScripts.from_bytes(backendTxWitnessSet.native_scripts().to_bytes())
        );
      }
      console.log("native after: ", namiWitnessSet.native_scripts())

      console.log("pscripts before: ", namiWitnessSet.plutus_scripts())
      if (backendTxWitnessSet.plutus_scripts()) {
        console.log("Setting scripts: ", backendTxWitnessSet.plutus_scripts())
        namiWitnessSet.set_plutus_scripts(
          PlutusScripts.from_bytes(backendTxWitnessSet.plutus_scripts().to_bytes())
        );
      }
      console.log("pscripts after: ", namiWitnessSet.plutus_scripts())

      console.log("datums before: ", namiWitnessSet.plutus_data())
      if (backendTxWitnessSet.plutus_data()) {
        console.log("Setting data: ", backendTxWitnessSet.plutus_data())
        namiWitnessSet.set_plutus_data(
          PlutusList.from_bytes(backendTxWitnessSet.plutus_data().to_bytes())
        );
      }
      console.log("datums after: ", namiWitnessSet.plutus_data())


      console.log("redeemers before: ", namiWitnessSet.redeemers())
      if (backendTxWitnessSet.redeemers()) {
        console.log("Setting redeemers: ", backendTxWitnessSet.redeemers())
        namiWitnessSet.set_redeemers(
          Redeemers.from_bytes(backendTxWitnessSet.redeemers().to_bytes())
        );
      }
      console.log("redeemers after: ", namiWitnessSet.redeemers())

      console.log("Vkeys: ", namiWitnessSet.vkeys())

      const resTx = Transaction.new(
        backendTx.body(),
        namiWitnessSet,
        // backendTx.auxiliary_data()
      )

      const resTxHex = Buffer.from(resTx.to_bytes()).toString('hex')
      console.log("Res hex: ", resTxHex)

      // ------ SUBMIT
      window.cardano.submitTx(resTxHex)
      .then(res => console.log("Submitted!"))
      .catch(err => console.log("Submission error: ", err))
      // ------ SUBMIT
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
      <button onClick={() => dhc("84a50081825820eb87c8b20ccf3767e5b81cf30061f645871ee3c103c74d2f7f66d4364b7e5263000d81825820513aefa8cce5435985cef0795a96cbbd3937fce77ad1ed715ce6df77a15fe27f000182825839005feb72668e5a4effd3b34088aa56e7d558f75afe4798b8364a739673700e4b6993cbc5e612f8770aa531243b3d888a81c0a46de5fa5f6a701a35560c4383581d70719ed02924d3a1656481f02af2adbdc229d14778b718e928695638d41a00b71b005820ff6191af0d39df3e972d56ecd3610316ff0ce4b1ab65a336a9adfea25c8aa3bc021a001e84800e80a10481d8799f46546573742031fff5f6")}>
        Debug hardcoded CBOR
      </button>
      <button onClick={() => debg(setState)}>
        Debug Definitions
      </button>
      <div>Address: {state.address} </div>
    </div>
  );
}

export default App;
