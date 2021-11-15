import './App.css';
import React, { useState } from 'react'


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
    })
    .catch(err => console.log("connect error", err))
}

const App = () => {
  const [state, setState] = useState({ address: "" });
  console.log("state", state)
  return (
    <div className="App">
      <button onClick={() => connect(setState)}>
        Click to activate Nami Wallet
      </button>
      <div>Address: {state.address} </div>
    </div>
  );
}

export default App;
