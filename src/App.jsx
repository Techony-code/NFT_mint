import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Your TieredNFT contract details
const CONTRACT_ADDRESS = '0xD128Fb1Eccc093A66996D750D8Ca3b9eB6368787';  // Your new contract
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;  // Testnet

// ABI for your TieredNFT (embedded - no JSON file needed)
const CONTRACT_ABI = [
  "function mintNFT(uint8 _tier) payable",
  "function normalPrice() view returns (uint256)",
  "function regularPrice() view returns (uint256)",
  "function vipPrice() view returns (uint256)",
  "function getTierAvailability(uint8 _tier) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function normalMinted() view returns (uint256)",
  "function regularMinted() view returns (uint256)",
  "function vipMinted() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

function App() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [imageUri, setImageUri] = useState('');
  const [tier, setTier] = useState(0);  // Selected tier (0=Normal, 1=Regular, 2=VIP)
  const [loading, setLoading] = useState(false);
  const [tokenId, setTokenId] = useState(null);  // Track minted ID
  const [showModal, setShowModal] = useState(false);  // For success modal
  const [availabilities, setAvailabilities] = useState({ normal: 0, regular: 0, vip: 0 });  // Track availability

  // Detect MetaMask
  useEffect(() => {
    if (window.ethereum && window.ethereum.isMetaMask) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setAccount('');
          setContract(null);
        } else {
          setAccount(accounts[0]);
        }
      });
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask not detected! Install it or use a compatible wallet.');
      return;
    }

    try {
      setLoading(true);
      // Request accounts
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const prov = new ethers.BrowserProvider(window.ethereum);
      const signer = await prov.getSigner();
      const acc = await signer.getAddress();
      setAccount(acc);
      setProvider(prov);

      // Switch to Arbitrum Sepolia
      const network = await prov.getNetwork();
      if (Number(network.chainId) !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa36a' }],  // 421614 hex
          });
        } catch (switchError) {
          // Add chain if not present
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa36a',
              chainName: 'Arbitrum Sepolia',
              rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://sepolia.arbiscan.io'],
            }],
          });
        }
      }

      // Create contract instance
      const cont = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(cont);

      // Load availability for all tiers
      const [normalAvail, regularAvail, vipAvail] = await Promise.all([
        cont.getTierAvailability(0),
        cont.getTierAvailability(1),
        cont.getTierAvailability(2)
      ]);
      setAvailabilities({
        normal: Number(normalAvail),
        regular: Number(regularAvail),
        vip: Number(vipAvail)
      });

      setLoading(false);
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect. Ensure MetaMask is on Arbitrum Sepolia.');
      setLoading(false);
    }
  };

  const mintNFT = async () => {
    if (!contract || !account) return alert('Connect MetaMask first!');
    if (tier < 0 || tier > 2) return alert('Select a valid tier!');

    // Check availability
    const avail = availabilities[tier === 0 ? 'normal' : tier === 1 ? 'regular' : 'vip'];
    if (avail === 0) return alert(`${['Normal', 'Regular', 'VIP'][tier]} tier sold out!`);

    try {
      setLoading(true);
      // Get prices from contract (dynamic)
      const [normalPrice, regularPrice, vipPrice] = await Promise.all([
        contract.normalPrice(),
        contract.regularPrice(),
        contract.vipPrice()
      ]);
      const prices = [
        ethers.formatEther(normalPrice),  // Tier 0: Normal ~0.0023 ETH
        ethers.formatEther(regularPrice), // Tier 1: Regular ~0.0066 ETH
        ethers.formatEther(vipPrice)      // Tier 2: VIP ~0.0165 ETH
      ];
      const price = ethers.parseEther(prices[tier]);

      const tx = await contract.mintNFT(tier, { value: price });
      alert('Minting... Waiting for confirmation.');
      const receipt = await tx.wait();

      // Get the new token ID
      const balance = await contract.balanceOf(account);
      const newTokenId = Number(balance);
      setTokenId(newTokenId);

      // Fetch tokenURI and image (with error handling)
      try {
        const tokenURI = await contract.tokenURI(newTokenId);
        if (!tokenURI || tokenURI === '') {
          setImageUri('https://placehold.co/500x500/FF6B6B/FFFFFF?text=Image+Loading...');
          alert('NFT minted! Metadata loading...');
        } else {
          const ipfsGateway = 'https://ipfs.io/ipfs/';
          const metadataUrl = tokenURI.replace('ipfs://', ipfsGateway);
          const metadataResponse = await fetch(metadataUrl);
          
          if (!metadataResponse.ok) {
            throw new Error(`HTTP ${metadataResponse.status}: ${metadataResponse.statusText}`);
          }
          
          const metadata = await metadataResponse.json();
          if (!metadata.image) {
            throw new Error('No image in metadata');
          }
          
          const imageUrl = metadata.image.replace('ipfs://', ipfsGateway);
          setImageUri(imageUrl);
        }
      } catch (fetchError) {
        console.error('Metadata fetch error:', fetchError);
        setImageUri('https://via.placeholder.com/500x500/FF6B6B/FFFFFF?text=Image+Loading...');
        alert(`NFT minted! Image loading failed: ${fetchError.message}. Check console.`);
      }

      // Show success modal
      setShowModal(true);

      alert(`Minted NFT #${newTokenId}! Tx: ${receipt.hash}\nView on Arbiscan: https://sepolia.arbiscan.io/tx/${receipt.hash}`);
      setLoading(false);
    } catch (error) {
      console.error('Mint failed:', error);
      alert(`Error: ${error.reason || error.message || 'Transaction failed. Check ETH balance and tier availability.'}`);
      setLoading(false);
    }
  };

  const getTierName = (t) => {
    switch (t) {
      case 0: return 'Normal (~$7)';
      case 1: return 'Regular (~$20)';
      case 2: return 'VIP (~$50)';
      default: return 'Unknown';
    }
  };

  const getTierClass = (t) => {
    switch (t) {
      case 0: return 'tier-normal';
      case 1: return 'tier-regular';
      case 2: return 'tier-vip';
      default: return '';
    }
  };

  const getTierAvailability = (t) => {
    return availabilities[t === 0 ? 'normal' : t === 1 ? 'regular' : 'vip'];
  };

  return (
    <div className="app-container">
      <h1>My Tiered NFT Minter (Arbitrum Testnet)</h1>
      <p className="subtitle">Connect MetaMask to mint tiered NFTs</p>
      <p className="contract">Contract: {CONTRACT_ADDRESS}</p>

      {!account ? (
        <div>
          <button onClick={connectWallet} disabled={loading} className="connect-btn">
            {loading ? (
              <>
                <div className="spinner"></div>
                Connecting...
              </>
            ) : (
              'Connect MetaMask'
            )}
          </button>
          <p className="footer">No MetaMask? <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Install here</a> or use WalletConnect-compatible app (e.g., Trust Wallet).</p>
        </div>
      ) : (
        <div>
          <div className="info-card">
            <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
          </div>

          <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            <option value={0}>Normal (0.0023 ETH ~$7) - Available: {availabilities.normal}</option>
            <option value={1}>Regular (0.0066 ETH ~$20) - Available: {availabilities.regular}</option>
            <option value={2}>VIP (0.0165 ETH ~$50) - Available: {availabilities.vip}</option>
          </select>

          <button onClick={mintNFT} disabled={loading} className="mint-btn">
            {loading ? (
              <>
                <div className="spinner"></div>
                Minting...
              </>
            ) : (
              `Mint ${getTierName(tier)} NFT`
            )}
          </button>

          <button onClick={() => {
            setAccount('');
            setContract(null);
            setImageUri('');
            setTokenId(null);
          }} className="disconnect-btn">
            Disconnect MetaMask
          </button>

          {imageUri && tokenId !== null && (
            <div className="info-card">
              <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>Your Minted NFT #{tokenId}:</h3>
              <img src={imageUri} alt="Minted NFT" className="nft-image" />
            </div>
          )}
        </div>
      )}

      {/* Success Modal for Better UX */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Minted Successfully!</h2>
            <p>Token ID: {tokenId}</p>
            <p>Tier: {getTierName(tier)}</p>
            <img src={imageUri} alt="NFT" className="modal-image" />
            <div className="modal-buttons">
              <a 
                href={`https://testnets.opensea.io/assets/arbitrum-sepolia/${CONTRACT_ADDRESS}/${tokenId}`} 
                target="_blank" 
                className="view-wallet-btn"
              >
                View in Wallet (OpenSea)
              </a>
              <button onClick={() => setShowModal(false)} className="close-modal-btn">
                Close
              </button>
            </div>
            <p className="modal-footer">Refresh MetaMask NFTs tab to see it!</p>
          </div>
        </div>
      )}

      <p className="footer">Testnet only. Use test ETH from faucets. Built with ❤️ on Arbitrum.</p>
    </div>
  );
}

export default App;