// hooks/useMintToken.js
import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { APP_CONFIG } from "../constants/Config";
import { auth } from "../services/Firebase";
import { useWallet } from "../contexts/WalletContext";
import { useChain } from "../contexts/ChainContext";
import WSYN_ABI from "../abi/OffchainMintTokenAbi.json";
import { getWSYNAddress, isWSYNDeployed, WSYN_EXPLORER } from "../constants/wsyn";

const BACKEND_URL = APP_CONFIG.BACKEND_URL;

// ─── Stage type reference ─────────────────────────────────────────────────────
// 'idle'               — waiting for user action
// 'requesting_voucher' — POST /api/mint/voucher in flight
// 'awaiting_passcode'  — voucher received, waiting for passcode entry in the UI
// 'waiting_tx'         — on-chain transaction submitted, waiting for confirmation
// 'success'            — mint confirmed on-chain
// 'error'              — something went wrong (see `error` field)

export const useMintToken = () => {
  const { createSignerForTransaction, wallet } = useWallet();
  const { activeChain } = useChain();

  const [stage, setStage] = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [resolvedFrom, setResolvedFrom] = useState(null);
  const [mintedAmountWei, setMintedAmountWei] = useState(null);
  // Stored internally between the two steps — not exposed in the return value
  const [_voucherData, _setVoucherData] = useState(null);

  const reset = useCallback(() => {
    setStage("idle");
    setTxHash(null);
    setError(null);
    setResolvedFrom(null);
    setMintedAmountWei(null);
    _setVoucherData(null);
  }, []);

  // ── Step 1: Request voucher from backend ────────────────────────────────────

  /**
   * Hit POST /api/mint/voucher with a Firebase ID token.
   * On success, stores the voucher and advances stage to 'awaiting_passcode'.
   * Returns true on success, false on failure.
   */
  const requestVoucher = useCallback(async () => {
    setError(null);
    setStage("requesting_voucher");

    try {
      if (!wallet?.address) {
        throw new Error(
          "No wallet connected. Please create or restore a wallet first.",
        );
      }

      if (!isWSYNDeployed(activeChain.id)) {
        throw new Error(
          `WSYN is not yet deployed on ${activeChain.name}. Please switch to Base Sepolia.`,
        );
      }

      if (!auth.currentUser) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      const idToken = await auth.currentUser.getIdToken(/* forceRefresh */ true);

      const response = await fetch(`${BACKEND_URL}/mint/voucher`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "X-Chain-Id": String(activeChain.id),
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (
          response.status === 400 &&
          data.error?.includes("No mintable balance")
        ) {
          throw new Error("You have no balance available to mint.");
        }
        throw new Error(data.error || "Failed to request mint voucher.");
      }

      if (!data.success || !data.voucher) {
        throw new Error("Unexpected response from server. Please try again.");
      }

      _setVoucherData(data);
      setResolvedFrom(data.resolvedFrom);
      setStage("awaiting_passcode");
      return true;
    } catch (err) {
      console.error("[useMintToken] requestVoucher:", err.message);
      setError(err.message);
      setStage("error");
      return false;
    }
  }, [wallet?.address, activeChain]);

  // ── Step 2: Execute on-chain mint ───────────────────────────────────────────

  /**
   * Decrypt the wallet with `passcode`, then call mintWithVoucher on the contract.
   * Must only be called after requestVoucher() has succeeded.
   * Returns true on success, false on failure.
   */
  const confirmMint = useCallback(
    async (passcode) => {
      if (!_voucherData) {
        setError("Voucher data is missing. Please request a new voucher.");
        setStage("error");
        return false;
      }

      setError(null);
      setStage("waiting_tx");

      try {
        const { voucher, mintFee, contractAddress, chainId } = _voucherData;

        // Guard: chain must not have changed since the voucher was issued
        if (chainId !== activeChain.id) {
          throw new Error(
            "Network changed since voucher was issued. Please try again.",
          );
        }

        // Decrypt wallet and attach to current chain's provider
        const signer = await createSignerForTransaction(passcode);

        const contract = new ethers.Contract(contractAddress, WSYN_ABI, signer);

        const tx = await contract.mintWithVoucher(
          voucher.recipient,
          BigInt(voucher.amount),
          voucher.nonce,
          voucher.validFrom,
          voucher.validUntil,
          voucher.signature,
          { value: BigInt(mintFee) },
        );

        console.log("[useMintToken] TX sent:", tx.hash);

        // Wait for 1 on-chain confirmation
        await tx.wait(1);

        setTxHash(tx.hash);
        setMintedAmountWei(voucher.amount);
        setStage("success");
        return true;
      } catch (err) {
        console.error("[useMintToken] confirmMint:", err);
        setError(parseContractError(err));
        setStage("error");
        return false;
      }
    },
    [_voucherData, activeChain.id, createSignerForTransaction],
  );

  const explorerUrl = txHash
    ? `${WSYN_EXPLORER[activeChain?.id] ?? "https://basescan.org"}/tx/${txHash}`
    : null;

  return {
    // State
    stage,
    txHash,
    explorerUrl,
    error,
    resolvedFrom,
    mintedAmountWei,
    // Actions
    requestVoucher,
    confirmMint,
    reset,
  };
};

// ─── Error parsing ─────────────────────────────────────────────────────────────

const parseContractError = (err) => {
  const raw = err?.reason ?? err?.shortMessage ?? err?.message ?? "Unknown error";

  if (raw.includes("user rejected") || raw.includes("ACTION_REJECTED")) {
    return "Transaction cancelled.";
  }
  if (raw.includes("VoucherExpired") || raw.includes("validUntil")) {
    return "Voucher expired. Please try again.";
  }
  if (raw.includes("InsufficientFee") || raw.includes("insufficient funds")) {
    return "You need at least 0.0004 ETH on Base to cover the mint fee.";
  }
  if (raw.includes("RecipientMismatch")) {
    return "Wallet address mismatch. Please use the wallet linked to your account.";
  }
  if (raw.includes("NonceAlreadyUsed")) {
    return "This voucher has already been used. Please request a new one.";
  }
  if (raw.includes("InvalidSigner")) {
    return "Voucher signature is invalid. Please request a new voucher.";
  }
  if (raw.includes("Invalid passcode")) {
    return "Incorrect passcode. Please try again.";
  }
  if (raw.includes("network changed") || raw.includes("NETWORK_ERROR")) {
    return "Please switch your wallet to Base network and try again.";
  }
  return raw;
};
