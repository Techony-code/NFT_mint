import { ethers } from 'ethers';

// Your contract address on Arbitrum Sepolia
export const CONTRACT_ADDRESS = '0xA20A30FB1b3c135D951E481f828486F2Ae44a854';

// ABI (contract interface)
export const CONTRACT_ABI = [
  "function mintNFT(uint8 _tier) payable",
  "function normalPrice() view returns (uint256)",
  "function regularPrice() view returns (uint256)",
  "function vipPrice() view returns (uint256)",
  "function getTierAvailability(uint8 _tier) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function normalMinted() view returns (uint256)",
  "function regularMinted() view returns (uint256)",
  "function vipMinted() view returns (uint256)",
  "function tokenTier(uint256 tokenId) view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)"
];

// Arbitrum Sepolia RPC
export const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

// Create contract instance
export const getContract = (signerOrProvider) => {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
};