/* eslint-disable */
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ToastContainer, toast } from 'material-react-toastify';

import './App.css';
import 'material-react-toastify/dist/ReactToastify.css';

import abi from "./utils/TheEpics.json";
import contractSVG from './assets/contract.svg';
import miningSVG from './assets/3dprinting.svg';
import confirmedSVG from './assets/checked_contract.svg';
import heartSVG from './assets/heart.svg';
import dropSVG from './assets/drop.svg';

const TESTNET_SITE = true;

// ** Immutables
const BUILDSPACE_TWITTER_HANDLE = "_buildspace";
const BUILDSPACE_TWITTER_LINK = `https://twitter.com/${BUILDSPACE_TWITTER_HANDLE}`;
const TWITTER_HANDLE = 'andreasbigger';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
const CONTRACT_ADDRESS = TESTNET_SITE ?
  "0x9548a49f25b1C80FB451ec40cC0401C067D4F6AF" :
  "0x0"
;
const CONTRACT_ABI = abi.abi;
const OPENSEA_COLLECTION_URL = TESTNET_SITE ?
  "https://testnets.opensea.io/collection/the-epics-v2" :
  "https://opensea.io/collection/the-epics-v2"
;

const DEPLOYED_CHAINS = [4];

export default function App() {
  const [currAccount, setCurrentAccount] = useState(null);
  const [currMintCount, setCurrMintCount] = useState(0);
  const [maxMintCount, setMaxMintCount] = useState(1337);
  const [myEpicNfts, setMyEpicNfts] = useState([]);
  const [toastLink, setToastLink] = useState("");
  const [chainId, setChainId] = useState(1);

  // ** Mining state variables
  const [isMining, setIsMining] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // ** Gallery Vars
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingGallery, setLoadingGallery] = useState(false);


  // ** Refactored get chain id logic from provider
  const getChainId = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const { chainId } = await provider.getNetwork()
    setChainId(chainId);
  }

  // ** Try to connect to wallet
  const checkIfWalletIsConnected = () => {
    const { ethereum } = window;
    if(!ethereum) {
      toast.error('🦊 Missing Metamask!', {
        position: "top-left",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return
    }

    // ** Try to get access to the user's wallet
    ethereum.request({ method: 'eth_accounts' })
    .then((accounts) => {
      // ** There could be multiple accounts
      if(accounts.length !== 0) {
        // ** Get the first account
        let account = accounts[0].toString().toLowerCase();

        // ** Get the chainId
        getChainId();

        // ** Store the account
        setCurrentAccount(account);

        // ** Load Account Gallery
        loadGallery(account);

        // ** Get the contract mint count info
        getMintCounts();

        // ** Set up our event listener
        setupEventListener(account);
      } else {
        // toast.error('No authorized accounts found! Please connect a metamask account!', {
        //   position: "top-left",
        //   autoClose: 3000,
        //   hideProgressBar: true,
        //   closeOnClick: true,
        //   pauseOnHover: true,
        //   draggable: true,
        // });
      }
    })
  }

  const loadGallery = async (account) => {
    setLoadingGallery(true);
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const eContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    let eventFilter = eContract.filters.EpicMinted();
    let events = await eContract.queryFilter(eventFilter)
    let tokens = [];
    await Promise.all(events.map(async (e, i) => {
      let tx_res = await e.getTransaction();
      let address = tx_res.from.toString().toLowerCase();
      if(address.trim() === account.trim()) {
        tokens.push({ tokenId: i, address: address });
      }
    }));
    setMyEpicNfts(tokens);
    setLoadingGallery(false);
  }

  const connectWallet = () => {
    const { ethereum } = window;

    if(!ethereum) {
      toast.error('🦊 Missing Metamask!', {
        position: "top-left",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }

    ethereum.request({ method: 'eth_requestAccounts' })
    .then((accounts) => {
      let account = accounts[0].toString().toLowerCase();
      setCurrentAccount(account);

      // ** Get the chainId
      getChainId();

      // ** Get the contract mint count info
      getMintCounts();

      // ** Set up our event listener
      setupEventListener(account);

      // ** Refresh page
      checkIfWalletIsConnected();
    })
    .catch((e) => {
      toast.error('Failed to load metamask accounts! Please refresh the page!', {
        position: "top-left",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    })
  }

  const askContractToMintNft = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        console.log("signer=============" , provider)
        const signer = provider.getSigner();
        const connectedContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        console.log("connectedContract" , connectedContract)

        console.log("Going to pop wallet now to pay gas...")
        let nftTxn;
        try {
          nftTxn = await connectedContract.makeAnEpicNFT();
        } catch (er) {
          console.log()
          return;
        }
        setIsMining(true);

        console.log("Mining...please wait.")
        await nftTxn.wait();
        setIsMining(false);

        console.log(`Mined, see transaction: https://rinkeby.etherscan.io/tx/${nftTxn.hash}`);
        setIsConfirmed(true);
        setTimeout(() => setIsConfirmed(false), 4000);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      toast.error('🎟️ Failed to mint, please try again!', {
        position: "top-left",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }

  // ** Refactor logic to fetch the MAX_MINT_COUNT and the current tokenId
  const getMintCounts = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const eContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      let max_count = await eContract.getMaxMintCount();
      setMaxMintCount(max_count.toNumber());
      let curr_count = await eContract.currentMintCount();
      setCurrMintCount(curr_count.toNumber());
    } catch (e) {
      toast.error('Failed to load the maximum mint count, make sure you are on the Rinkeby Testnet!', {
        position: "top-left",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }

  // ** Setup our listener
  const setupEventListener = async (account) => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const connectedContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        connectedContract.on("EpicMinted", (id, from) => {
          let tokenId = id.toNumber();
          // let sender = from;

          // ** Update the current minted count
          setCurrMintCount(tokenId + 1);

          // ** Load new Gallery
          loadGallery(account);

          // ** Set toast link
          setToastLink(`https://testnets.opensea.io/assets/${CONTRACT_ADDRESS}/${tokenId}`);

          toast(`🦄 NFT Minted!`, {
            position: "top-left",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });

          // ** Reset Toast link after toast duration
          setTimeout(() => setToastLink(OPENSEA_COLLECTION_URL), 3000);
        });
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      toast.warn('Not your fault, we failed to set up notifications for minting! This means you\'ll have to refresh the page when you finish minting :)', {
        position: "top-left",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }

  useEffect(() => {
    checkIfWalletIsConnected();
    // ** After 4 seconds (one dropping animation cycle) we want to set initial load to false
    setTimeout(() => setInitialLoading(false), 4000);
  }, [])

  return (
    <div className="App">
      <a
        href={toastLink}
        target="_blank"
        rel="noreferrer"
      >
        <ToastContainer />
      </a>
      <div className="container">
        <div className="header-container">
          <p className="header">
            <span style={{ marginRight: '0.3em' }} role="img" aria-label="wave">⚡</span>
            <span className="gradient-text">The Epics</span>
            <img alt="Contract Logo" className="contract-logo" src={contractSVG} />
          </p>
          <p className="sub-text">
            🚨 Contracts only deployed on the Rinkeby Testnet 🚨
          </p>
          <p className="sub-text">
            Unique, Beautiful <span className="rainbow bg-clip-text text-transparent font-bold">Dinosaurs and Caves</span> inspired by {" "}
            <span className="loot-gradient-text">
              <a
                className="no-decoration"
                href="https://lootproject.com"
                target="_blank"
                rel="noreferrer"
              >
                Loot
              </a>
            </span>
          </p>
          {DEPLOYED_CHAINS.includes(chainId) ? (
            <div className="bio">
              <span className="bio-text">{currMintCount}/{maxMintCount}</span> Epics have been minted!
            </div>
          ) : null}
          <div style={{display: 'flex', flexDirection:'column'}}>
            <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', margin: 'auto'}}>
              {currAccount && !isMining && !isConfirmed ? (
                <button
                  disabled={(currMintCount >= maxMintCount || !DEPLOYED_CHAINS.includes(chainId)) ? true : false}
                  className="waveButton cta-button connect-wallet-button"
                  onClick={askContractToMintNft}
                  style={{
                    opacity: (currMintCount >= maxMintCount || !DEPLOYED_CHAINS.includes(chainId)) ? 0.5 : 1,
                  }}
                  >
                  Mint an Epic!
                </button>
              ) : null}
              <button
                className="cta-button opensea-button"
                onClick={(e) => {
                  e.preventDefault()
                  if(window) {
                    window.open(OPENSEA_COLLECTION_URL, "_blank")
                  }
                }}
                >
                Opensea Collection <span style={{marginLeft: '0.2em'}}>🌊</span>
              </button>
            </div>
            {currAccount && isMining && !isConfirmed ? (
              <div style={{display: 'flex', flexDirection: 'column', margin: 'auto'}}>
                <img alt="Mining Logo" className="mining-logo" src={miningSVG} />
                <p style={{ fontStyle: 'italic', color: 'white', paddingBottom: '0.5em' }}>your transaction is being mined...</p>
              </div>
            ) : null}
            {currAccount && !isMining && isConfirmed ? (
              <div style={{display: 'flex', flexDirection: 'column', margin: 'auto'}}>
                <img alt="Confirmed Logo" className="confirmed-logo" src={confirmedSVG} /
                >
              </div>
            ) : null}
            {currAccount ? null : (
              <div style={{display: 'flex', flexDirection: 'column', margin: 'auto'}}>
                <button className="waveButton cta-button connect-wallet-button" onClick={connectWallet}>
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              padding: '1em',
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              // maxHeight: '600px',
              overflow: 'scroll',
              maxWidth: '1000px',
              margin: 'auto',
              flexGrow: 1
            }}>
            {initialLoading && currAccount !== null ? (
              <div style={{display: 'flex', flexDirection: 'column', margin: 'auto'}}>
                <img alt="Loading Logo" className="loading-logo" src={dropSVG} />
                <p style={{ fontStyle: 'italic', color: 'white', paddingBottom: '0.5em' }}>Loading your Epics...</p>
              </div>
            ) : null}

            {!initialLoading && !loadingGallery && myEpicNfts.length <= 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', margin: 'auto'}}>
                <p className="sub-text">
                  Wallet{" "}
                  <a
                    className="no-decoration"
                    href={`https://etherscan.io/${currAccount ? currAccount : ""}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {currAccount !== null ? (
                      <span>{currAccount.substring(0, 4)}..{currAccount.substring(currAccount.length - 2)}</span>)
                      : null
                    }
                  </a>
                  {" "}hasn't minted any Epics recently!
                </p>
                <p className="sub-text">
                  Mint some, and they'll show up here!
                </p>
              </div>
            ) : null}

            {!initialLoading && myEpicNfts.length >= 0 ? myEpicNfts.sort((a, b) => a.tokenId > b.tokenId ? 1 : -1).map((epic, index) => {
              return (
                <div
                  key={Object.entries(epic).toString() + index.toString()}
                  style={{
                    margin: '1em',
                    padding: '1em',
                    maxWidth: '260px',
                    wordBreak: 'break-all',
                    borderRadius: '4px',
                    color: 'white',
                    borderColor: 'white',
                    borderWidth: '2px',
                    borderStyle: 'solid'
                  }}>
                  <div className="lh15">TokenId: {epic.tokenId.toString()}</div>
                  <div className="lh15">Address: {epic.address}</div>
                  <div className="lh15"><a className="no-decoration" href={`https://testnets.opensea.io/assets/${CONTRACT_ADDRESS}/${epic.tokenId.toString()}`}>View on Opensea</a></div>
                  {/*
                    // TODO: fetch the metadata for each and pull in the Base64 tokenURI as an svg!
                  */}
                </div>
              )
            }) : null}
          </div>
        </div>
        <div className="footer-wrapper">
          <div className="footer-container text-sm">
            <p className="white-text align-center">
              Built with{" "}
              <img alt="Heart Logo" className="heart-logo" src={heartSVG} />
              {" "}
              by
              {" "}
              <a
                className="footer-text sm-pl"
                href={TWITTER_LINK}
                target="_blank"
                rel="noreferrer"
              >
                {`@${TWITTER_HANDLE}`}
              </a>
            </p>
          </div>
          <div className="footer-container text-sm">
            {/* <img alt="Unicorn Logo" className="uni-logo" src={twitterLogo} /> */}
            <p className="white-text">
              🦄 h/t{" "}
              <a
                className="footer-text"
                href={BUILDSPACE_TWITTER_LINK}
                target="_blank"
                rel="noreferrer"
              >
                {`@${BUILDSPACE_TWITTER_HANDLE}`}
              </a>
              {" "} for the amazing course!
            </p>
          </div>
          <div className="text-sm p-5 md:p-16 white-text">
            <A href={`https://rinkeby.etherscan.io/address/${CONTRACT_ADDRESS}`}>Etherscan</A> &bull;{" "}
            <A href={OPENSEA_COLLECTION_URL}>OpenSea</A> &bull;{" "}
            <A href="https://github.com/abigger87/epic-nfts">Contract Source</A> &bull;{" "}
            <A href="https://github.com/abigger87/epic-nfts-ui">UI Source</A> &bull;{" "}
            <A href="https://twitter.com/andreasbigger">Twitter</A> &bull;{" "}
            <span className="white-text">There's no Discord</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const A = (props) => <a className="text-blue-500 no-decoration" {...props} />;