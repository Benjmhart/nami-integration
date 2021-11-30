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

//

const sign = (tx) => {
  console.log("sign txn")
  window.cardano.signTx(tx)
    .then(result => console.log("Success"))
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
      <button onClick={() => sign("84a50081825820fd1e09ea0960dc55ae0cfbfc8ad93928d06d232db430a25b16c5dfeae5bff3fe000d81825820fd1e09ea0960dc55ae0cfbfc8ad93928d06d232db430a25b16c5dfeae5bff3fe00018282583900a3d0b159b730b4d28907681823a6ca155ce50f8614e00325daa85bd1da859f3b7756c74bd1f92e41928a5af7aaeddb07d89af26c757437aa1a3b1175c082581d605feb72668e5a4effd3b34088aa56e7d558f75afe4798b8364a7396731a006acfc0021a001e84800e80a0f5f6")}>
        Sign
      </button>
      <div>Address: {state.address} </div>
    </div>
  );
}

export default App;
