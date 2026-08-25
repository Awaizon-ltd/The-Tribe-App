// hooks/useSwapExecute.js
import { useState, useCallback } from "react";
import { Contract, parseUnits } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import { useChain } from "../contexts/ChainContext";
import { getSwapConfig } from "../config/swapConfig";
import {
  isNativeToken,
  needsApproval as checkNeedsApproval,
} from "../utils/NativeTokens";

// Standard ERC20 ABI for approval
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

/**
 * Hook for executing swaps
 */
export function useSwapExecute() {
  const { provider, address, createSignerForTransaction } = useWallet();
  const { activeChain } = useChain();

  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Check if token approval is needed
   * Native tokens (ETH, BNB, MATIC, etc.) never need approval
   */
  const checkApproval = useCallback(
    async (tokenAddress, amount) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      // Native tokens don't need approval
      if (isNativeToken({ address: tokenAddress })) {
        console.log("[useSwapExecute] Native token - no approval needed");
        return true; // Already "approved"
      }

      try {
        const config = getSwapConfig(activeChain.id);
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);

        const allowance = await tokenContract.allowance(
          address,
          config.routerAddress,
        );

        console.log(
          "[useSwapExecute] Current allowance:",
          allowance.toString(),
        );
        console.log("[useSwapExecute] Required amount:", amount);

        return BigInt(allowance.toString()) >= BigInt(amount);
      } catch (err) {
        console.error("[useSwapExecute] Error checking approval:", err);
        throw err;
      }
    },
    [provider, address, activeChain],
  );

  /**
   * Approve token spending
   */
  const approveToken = useCallback(
    async (tokenAddress, amount, passcode) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      setIsApproving(true);
      setError(null);

      try {
        const config = getSwapConfig(activeChain.id);
        const signer = await createSignerForTransaction(passcode);
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

        console.log("[useSwapExecute] Approving token...");

        // Approve max amount for better UX (user won't need to approve again)
        const MAX_UINT256 =
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const tx = await tokenContract.approve(
          config.routerAddress,
          MAX_UINT256,
        );

        console.log("[useSwapExecute] Approval tx submitted:", tx.hash);

        const receipt = await tx.wait();

        console.log("[useSwapExecute] ✅ Approval confirmed");

        return receipt;
      } catch (err) {
        console.error("[useSwapExecute] ❌ Approval failed:", err);
        setError(err);
        throw err;
      } finally {
        setIsApproving(false);
      }
    },
    [provider, address, activeChain, createSignerForTransaction],
  );

  /**
   * Execute swap (automatically detects native/token and uses correct function)
   */
  const executeSwap = useCallback(
    async (quote, passcode) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      if (!quote) {
        throw new Error("No quote available");
      }

      setIsSwapping(true);
      setError(null);

      try {
        const config = getSwapConfig(activeChain.id);
        const signer = await createSignerForTransaction(passcode);
        const router = new Contract(config.routerAddress, config.abi, signer);

        // Set deadline (10 minutes from now)
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        console.log("[useSwapExecute] Executing swap...");
        console.log("[useSwapExecute] From native:", quote.isFromNative);
        console.log("[useSwapExecute] To native:", quote.isToNative);
        console.log("[useSwapExecute] Path:", quote.path);
        console.log("[useSwapExecute] Amount in:", quote.amountIn);
        console.log("[useSwapExecute] Min amount out:", quote.minAmountOut);
        console.log("[useSwapExecute] Deadline:", deadline);

        let tx;

        // Native → Token (ETH/BNB/MATIC to Token)
        if (quote.isFromNative) {
          console.log("[useSwapExecute] Using swapExactETHForTokens");
          tx = await router.swapExactETHForTokens(
            quote.minAmountOut,
            quote.path,
            address,
            deadline,
            { value: quote.amountIn },
          );
        }
        // Token → Native (Token to ETH/BNB/MATIC)
        else if (quote.isToNative) {
          console.log("[useSwapExecute] Using swapExactTokensForETH");
          tx = await router.swapExactTokensForETH(
            quote.amountIn,
            quote.minAmountOut,
            quote.path,
            address,
            deadline,
          );
        }
        // Token → Token
        else {
          console.log("[useSwapExecute] Using swapExactTokensForTokens");
          tx = await router.swapExactTokensForTokens(
            quote.amountIn,
            quote.minAmountOut,
            quote.path,
            address,
            deadline,
          );
        }

        console.log("[useSwapExecute] Swap tx submitted:", tx.hash);

        const receipt = await tx.wait();

        console.log("[useSwapExecute] ✅ Swap confirmed");

        return receipt;
      } catch (err) {
        console.error("[useSwapExecute] ❌ Swap failed:", err);

        let errorMessage = "Swap failed";

        if (err.message?.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
          errorMessage =
            "Insufficient output amount. Try increasing slippage tolerance.";
        } else if (err.message?.includes("EXPIRED")) {
          errorMessage = "Transaction expired. Please try again.";
        } else if (err.message?.includes("TRANSFER_FAILED")) {
          errorMessage = "Token transfer failed. Check your balance.";
        } else if (err.message?.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas or token amount.";
        }

        const error = { message: errorMessage, original: err.message };
        setError(error);
        throw error;
      } finally {
        setIsSwapping(false);
      }
    },
    [provider, address, activeChain, createSignerForTransaction],
  );

  /**
   * Execute ETH-to-token swap
   */
  const executeETHToTokenSwap = useCallback(
    async (quote, passcode) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      if (!quote) {
        throw new Error("No quote available");
      }

      setIsSwapping(true);
      setError(null);

      try {
        const config = getSwapConfig(activeChain.id);
        const signer = await createSignerForTransaction(passcode);
        const router = new Contract(config.routerAddress, config.abi, signer);

        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        console.log("[useSwapExecute] Executing ETH-to-token swap...");

        const tx = await router.swapExactETHForTokens(
          quote.minAmountOut,
          quote.path,
          address,
          deadline,
          { value: quote.amountIn },
        );

        console.log("[useSwapExecute] Swap tx submitted:", tx.hash);

        const receipt = await tx.wait();

        console.log("[useSwapExecute] ✅ Swap confirmed");

        return receipt;
      } catch (err) {
        console.error("[useSwapExecute] ❌ ETH swap failed:", err);
        setError(err);
        throw err;
      } finally {
        setIsSwapping(false);
      }
    },
    [provider, address, activeChain, createSignerForTransaction],
  );

  /**
   * Execute token-to-ETH swap
   */
  const executeTokenToETHSwap = useCallback(
    async (quote, passcode) => {
      if (!provider || !address) {
        throw new Error("Wallet not connected");
      }

      if (!quote) {
        throw new Error("No quote available");
      }

      setIsSwapping(true);
      setError(null);

      try {
        const config = getSwapConfig(activeChain.id);
        const signer = await createSignerForTransaction(passcode);
        const router = new Contract(config.routerAddress, config.abi, signer);

        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        console.log("[useSwapExecute] Executing token-to-ETH swap...");

        const tx = await router.swapExactTokensForETH(
          quote.amountIn,
          quote.minAmountOut,
          quote.path,
          address,
          deadline,
        );

        console.log("[useSwapExecute] Swap tx submitted:", tx.hash);

        const receipt = await tx.wait();

        console.log("[useSwapExecute] ✅ Swap confirmed");

        return receipt;
      } catch (err) {
        console.error("[useSwapExecute] ❌ Token-to-ETH swap failed:", err);
        setError(err);
        throw err;
      } finally {
        setIsSwapping(false);
      }
    },
    [provider, address, activeChain, createSignerForTransaction],
  );

  return {
    checkApproval,
    approveToken,
    executeSwap, // ✅ Main function - automatically handles native/token swaps
    executeETHToTokenSwap, // Deprecated - use executeSwap instead
    executeTokenToETHSwap, // Deprecated - use executeSwap instead
    isApproving,
    isSwapping,
    error,
  };
}
