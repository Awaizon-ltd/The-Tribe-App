import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import api from "../services/TribeApiService";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

/**
 * Resolves token-gating config and checks whether the user holds the required token.
 *
 * @param {string}  tribeId           - Tribe ID
 * @param {object}  user              - Firebase auth user
 * @param {string}  address           - User's wallet address
 * @param {string}  privacy           - "public" | "private"
 * @param {boolean} isMember          - Whether the user is already a member
 * @param {object}  initialTokenGating - Token gating data already available from the tribe object
 *                                       (avoids an extra API call if the parent already fetched the tribe)
 */
export const useTokenGating = (
  tribeId,
  user,
  address,
  privacy,
  isMember,
  initialTokenGating = null,
) => {
  const [tokenGatingData, setTokenGatingData]   = useState(initialTokenGating);
  const [hasRequiredToken, setHasRequiredToken] = useState(false);
  const [tokenCheckLoading, setTokenCheckLoading] = useState(false);
  const [tokenMetaLoading, setTokenMetaLoading]   = useState(!initialTokenGating);
  const [tokenChecked, setTokenChecked]           = useState(false);

  const walletContext = useWallet();
  const { provider } = walletContext || {};

  // ── Fetch token gating config ────────────────────────────────────────────────
  useEffect(() => {
    // If the parent already supplied the config, use it directly
    if (initialTokenGating !== null) {
      setTokenGatingData(initialTokenGating);
      setTokenMetaLoading(false);
      return;
    }
    if (!tribeId) return;
    fetchTokenGatingData();
  }, [tribeId]);

  // ── Trigger balance check once config + address are ready ────────────────────
  useEffect(() => {
    if (!tokenGatingData) return;
    if (!user)             return;
    if (privacy !== "private") return;
    if (isMember)          return;
    if (!address)          return;
    if (tokenChecked)      return;

    setTokenChecked(true);
    checkTokenBalance();
  }, [address, tokenGatingData, privacy, isMember]);

  const fetchTokenGatingData = async () => {
    try {
      const tribeData = await api.getTribe(tribeId);
      // Backend returns token_gating (snake_case JSONB) or tokenGating (camelCase)
      const tg = tribeData?.token_gating || tribeData?.tokenGating || null;
      setTokenGatingData(tg);
    } catch (error) {
      console.error("Error fetching token gating data:", error);
    } finally {
      setTokenMetaLoading(false);
    }
  };

  const checkTokenBalance = async () => {
    if (!tokenGatingData || !user) return;

    setTokenCheckLoading(true);
    setTokenMetaLoading(true);

    try {
      if (!address) {
        setHasRequiredToken(false);
        return;
      }

      const result = await checkTokenBalanceOnChain(
        address,
        tokenGatingData.tokenAddress,
        tokenGatingData.tokenType,
        tokenGatingData.minTokenAmount,
      );

      setHasRequiredToken(result.hasToken);

      setTokenGatingData((prev) => {
        if (
          prev?.name === result.name &&
          prev?.symbol === result.symbol &&
          prev?.userBalance === result.balance
        ) {
          return prev;
        }
        return { ...prev, name: result.name, symbol: result.symbol, userBalance: result.balance };
      });
    } catch (error) {
      console.error("Error checking token balance:", error);
      setHasRequiredToken(false);
    } finally {
      setTokenCheckLoading(false);
      setTokenMetaLoading(false);
    }
  };

  const checkTokenBalanceOnChain = async (address, tokenAddress, tokenType, minAmount = 1) => {
    try {
      // ethers v6 — use ethers.isAddress (not ethers.utils.isAddress)
      if (!ethers.isAddress(address) || !ethers.isAddress(tokenAddress)) {
        return { hasToken: false, name: null, symbol: null, balance: 0 };
      }

      const ABI      = tokenType === "Token" ? ERC20_ABI : ERC721_ABI;
      const contract = new ethers.Contract(tokenAddress, ABI, provider);

      if (tokenType === "Token") {
        const [rawBalance, decimals, name, symbol] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
          contract.name(),
          contract.symbol(),
        ]);

        // ethers v6 — formatUnits lives on the top-level ethers object
        const humanBalance = parseFloat(ethers.formatUnits(rawBalance, decimals));

        return {
          hasToken: humanBalance >= Number(minAmount),
          name,
          symbol,
          balance: humanBalance,
        };
      }

      if (tokenType === "NFT") {
        const [balance, name, symbol] = await Promise.all([
          contract.balanceOf(address),
          contract.name(),
          contract.symbol(),
        ]);

        // ethers v6 returns BigInt for uint256
        return {
          hasToken: balance > 0n,
          name,
          symbol,
          balance: Number(balance),
        };
      }

      return { hasToken: false, name: null, symbol: null, balance: 0 };
    } catch (error) {
      console.error("Token balance check error:", error);
      return { hasToken: false, name: null, symbol: null, balance: 0 };
    }
  };

  return {
    tokenGatingData,
    hasRequiredToken,
    tokenCheckLoading,
    tokenMetaLoading,
    checkTokenBalance,
  };
};
