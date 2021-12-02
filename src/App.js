import './App.css';
import React, { useState } from 'react'
import { Transaction, TransactionWitnessSet, Address } from '@emurgo/cardano-serialization-lib-asmjs'
import {Buffer} from 'buffer/'

const hexToBytes = (hex) => Buffer.from(hex, "hex");
    
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
      console.log ("addresses returned", addrs)
      setState({ address: addrs[0] })
      console.log("done")
      return addrs[0]
    })
    .then(addr => {
      const fixedAddr = Address.from_bytes(hexToBytes(addr), "hex").to_bech32()
      console.log(fixedAddr)
      const data = JSON.stringify(
        {caID: {
          contents: {
            ownAddress: fixedAddr
            },
          tag: 'Roundtrip'
          }
        }
      )
      console.log("Activation JSON: ", data)
      return fetch("http://localhost:9080/api/contract/activate",
                  { method: "POST" , 
                    headers: {"Content-type" : "application/json"},
                    mode: 'no-cors',
                    body: data
                  })
    })
    .then(res => console.log(res))
    .catch(err => console.log("Error: ", err))
    
}

const submit = (tx, wits) => {
  const txn = Transaction.from_bytes(Buffer.from(tx,'hex')) 
  // console.log('Tx is valid: ', txn.is_valid())
  const witnessSet = TransactionWitnessSet.from_bytes(Buffer.from(wits, 'hex'))
  const signedTx = Transaction.new(txn.body(), witnessSet)
  window.cardano.submitTx(Buffer.from(signedTx.to_bytes()).toString('hex'))
}

const sign = (tx) => {
  console.log("sign txn")
  window.cardano.signTx(tx)
    // .then(result => console.log("Success"))
    .then(wits => submit(tx, wits))
    .then(submitResult => console.log("Submitted: ", submitResult))
    .catch(err => console.log("error: ", err))
}

const App = () => {
  const [state, setState] = useState({ address: "" });
  console.log("state", state)
  return (
    <div className="App">
      <button onClick={() => connect(setState)}>
        Click to activate Nami Wallet
      </button>
      <button onClick={() => sign("84a500818258200aae5c2b619ba6ddba8924e3ce2e178e2b788e10ee291781c996f05de4a39f7b000d81825820513aefa8cce5435985cef0795a96cbbd3937fce77ad1ed715ce6df77a15fe27f000182825839005feb72668e5a4effd3b34088aa56e7d558f75afe4798b8364a739673700e4b6993cbc5e612f8770aa531243b3d888a81c0a46de5fa5f6a701a3a3944c382581d60a3d0b159b730b4d28907681823a6ca155ce50f8614e00325daa85bd11a006acfc0021a001e84800e80a0f5f6")}>
        Sign & Submit
      </button>
      <div>Address: {state.address} </div>
    </div>
  );
}

export default App;
