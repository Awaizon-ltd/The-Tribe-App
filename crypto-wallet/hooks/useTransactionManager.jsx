// hooks/useTransactionManager.js
import { useState } from "react";
import { Contract, formatEther, formatUnits, parseEther } from "ethers";
import { useWallet } from "../contexts/WalletContext";

// Helper function to parse and format error messages
const parseErrorMessage = (error) => {
  // Check if user rejected the transaction
  if (error.code === 4001 || error.code === "ACTION_REJECTED") {
    return {
      title: "Transaction Cancelled",
      message: "You cancelled the transaction. No changes were made.",
      type: "cancelled",
    };
  }

  // Insufficient funds
  if (
    error.code === "INSUFFICIENT_FUNDS" ||
    error.message?.includes("insufficient funds") ||
    error.message?.includes("insufficient balance")
  ) {
    return {
      title: "Insufficient Funds",
      message: "You don't have enough tokens to complete this transaction. Please add funds to your wallet.",
      type: "insufficient_funds",
    };
  }

  // Gas estimation errors
  if (
    error.code === "UNPREDICTABLE_GAS_LIMIT" ||
    error.message?.includes("cannot estimate gas") ||
    error.message?.includes("gas required exceeds allowance")
  ) {
    return {
      title: "Transaction Will Fail",
      message: "This transaction is likely to fail. Please check the transaction details and try again.",
      type: "gas_error",
    };
  }

  // Network errors
  if (
    error.code === "NETWORK_ERROR" ||
    error.message?.includes("network") ||
    error.message?.includes("timeout")
  ) {
    return {
      title: "Network Error",
      message: "Unable to connect to the blockchain network. Please check your internet connection and try again.",
      type: "network_error",
    };
  }

  // Nonce errors
  if (
    error.code === "NONCE_EXPIRED" ||
    error.message?.includes("nonce") ||
    error.message?.includes("replacement transaction underpriced")
  ) {
    return {
      title: "Transaction Conflict",
      message: "A transaction conflict occurred. Please wait a moment and try again.",
      type: "nonce_error",
    };
  }

  // Contract revert with reason
  if (error.reason) {
    return {
      title: "Transaction Failed",
      message: error.reason,
      type: "contract_revert",
    };
  }

  // Contract execution reverted
  if (
    error.code === "CALL_EXCEPTION" ||
    error.message?.includes("execution reverted") ||
    error.message?.includes("revert")
  ) {
    const revertMatch = error.message?.match(/revert(?:ed)?(?:\s+with\s+reason\s+string\s+)?['"]?([^'"]+)['"]?/i);
    const customMessage = revertMatch?.[1];

    return {
      title: "Transaction Rejected",
      message: customMessage || "The smart contract rejected this transaction. Please verify your inputs and try again.",
      type: "contract_revert",
    };
  }

  // Gas price too low
  if (
    error.message?.includes("transaction underpriced") ||
    error.message?.includes("gas price too low")
  ) {
    return {
      title: "Gas Price Too Low",
      message: "The gas price is too low for the current network conditions. Please try again with a higher gas price.",
      type: "gas_price_low",
    };
  }

  // Already known transaction
  if (error.message?.includes("already known")) {
    return {
      title: "Duplicate Transaction",
      message: "This transaction is already pending. Please wait for it to complete.",
      type: "duplicate",
    };
  }

  // RPC errors
  if (error.code === -32603 || error.message?.includes("Internal JSON-RPC error")) {
    return {
      title: "RPC Error",
      message: "There was an error communicating with the blockchain. Please try again in a moment.",
      type: "rpc_error",
    };
  }

  // Generic fallback with error code if available
  const errorCode = error.code ? ` (Error code: ${error.code})` : "";
  return {
    title: "Transaction Error",
    message: `An unexpected error occurred${errorCode}. Please try again or contact support if the issue persists.`,
    type: "unknown",
    originalError: error.message,
  };
};

export function useTransactionManager() {
  const { provider } = useWallet();
  
  const [gasInfo, setGasInfo] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 🧮 ENHANCED: Estimate gas details with native transfer support
   */
  async function estimateGas({ 
    // For native transfers
    isNativeTransfer = false,
    to,
    // For contract calls
    address, 
    abi, 
    functionName, 
    args = [], 
    value = "0",
    from,
    signer,
  }) {
    if (!provider) {
      const error = {
        title: "Provider Not Available",
        message: "Please wait for the provider to initialize.",
        type: "provider_not_available",
      };
      setError(error);
      throw error;
    }

    setIsEstimating(true);
    setError(null);

    try {
      let gasLimit;
      
      if (isNativeTransfer) {
        // ✅ Estimate gas for native transfer
        console.log('[TransactionManager] 📊 Estimating gas for native transfer');
        console.log('[TransactionManager] To:', to);
        console.log('[TransactionManager] Value:', value);
        
        const tx = {
          to,
          value: typeof value === "string" && !value.includes(".") 
            ? BigInt(value) 
            : parseEther(value),
        };
        
        if (from) {
          tx.from = from;
        }
        
        // Use signer or provider to estimate gas
        const estimator = signer || provider;
        gasLimit = await estimator.estimateGas(tx);
        
      } else {
        // ✅ Estimate gas for contract call
        console.log('[TransactionManager] 📊 Estimating gas for contract call');
        
        const contract = new Contract(address, abi, signer || provider);
        
        const overrides = {};
        
        if (from) {
          overrides.from = from;
          console.log('[TransactionManager] 🎯 Estimating gas for address:', from);
        }
        
        if (value && value !== "0") {
          try {
            overrides.value = typeof value === "string" && !value.includes(".") 
              ? BigInt(value) 
              : parseEther(value);
          } catch (err) {
            const error = {
              title: "Invalid Amount",
              message: "The transaction amount is invalid. Please check the value and try again.",
              type: "invalid_value",
            };
            setError(error);
            throw error;
          }
        }

        gasLimit = await contract[functionName].estimateGas(...args, overrides);
      }
      
      // Fetch fee data + latest block in parallel for accurate EIP-1559 estimation
      const [feeData, block] = await Promise.all([
        provider.getFeeData(),
        provider.getBlock('latest'),
      ]);

      // EIP-1559 (Base, Ethereum, Polygon, Arbitrum): use baseFeePerGas from the
      // latest block + maxPriorityFeePerGas. Add a 10 % buffer to the base fee to
      // cover the next block. Cap at maxFeePerGas so we never over-estimate.
      // Legacy chains: fall back to plain gasPrice.
      let effectiveGasPrice;
      if (feeData.maxFeePerGas && block?.baseFeePerGas) {
        const nextBaseFee = (block.baseFeePerGas * 110n) / 100n;
        const priorityFee = feeData.maxPriorityFeePerGas ?? 1_000_000_000n; // 1 gwei floor
        effectiveGasPrice = nextBaseFee + priorityFee;
        if (effectiveGasPrice > feeData.maxFeePerGas) effectiveGasPrice = feeData.maxFeePerGas;
      } else {
        effectiveGasPrice = feeData.gasPrice ?? 1_000_000_000n;
      }

      const estimatedCostEth = parseFloat(formatEther(gasLimit * effectiveGasPrice));

      const info = {
        gasLimit: gasLimit.toString(),
        gasPrice: formatUnits(effectiveGasPrice, "gwei"),
        estimatedCostEth,
        maxFeePerGas: feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, "gwei") : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, "gwei") : null,
        isEIP1559: !!feeData.maxFeePerGas,
      };

      setGasInfo(info);
      setError(null);
      console.log('[TransactionManager] ✅ Gas estimation successful:', info);
      return info;
    } catch (err) {
      console.error("[TransactionManager] Gas estimation failed:", err);
      const parsedError = parseErrorMessage(err);
      setError(parsedError);
      throw parsedError;
    } finally {
      setIsEstimating(false);
    }
  }

  /**
   * 🚀 Execute contract transaction securely with temporary signer
   */
  async function executeTransaction({ 
    address, 
    abi, 
    functionName, 
    args = [], 
    value = "0", 
    gasLimit = null,
    signer,
  }) {
    if (!signer) {
      const error = {
        title: "Signer Not Available",
        message: "Please unlock your wallet to continue.",
        type: "signer_not_available",
      };
      setError(error);
      throw error;
    }

    setError(null);

    try {
      console.log('[TransactionManager] 🔐 Executing contract transaction with temporary signer');
      
      const contract = new Contract(address, abi, signer);
      
      const overrides = {};
      if (value && value !== "0") {
        try {
          overrides.value = typeof value === "string" && !value.includes(".") 
            ? BigInt(value) 
            : parseEther(value);
        } catch (err) {
          const error = {
            title: "Invalid Amount",
            message: "The transaction amount is invalid. Please check the value and try again.",
            type: "invalid_value",
          };
          setError(error);
          throw error;
        }
      }

      if (gasLimit) {
        overrides.gasLimit = BigInt(gasLimit);
      }

      console.log(`[TransactionManager] Submitting ${functionName}...`);
      const tx = await contract[functionName](...args, overrides);
      console.log(`[TransactionManager] ✅ Transaction submitted:`, tx.hash);

      setError(null);
      return { hash: tx.hash };
    } catch (err) {
      console.error("[TransactionManager] ❌ Execution failed:", err);
      const parsedError = parseErrorMessage(err);
      setError(parsedError);
      throw parsedError;
    }
  }

  /**
   * 💸 NEW: Execute native transfer (ETH, BNB, MATIC, etc.)
   */
  async function executeNativeTransfer({
    to,
    value,
    gasLimit = null,
    signer,
  }) {
    if (!signer) {
      const error = {
        title: "Signer Not Available",
        message: "Please unlock your wallet to continue.",
        type: "signer_not_available",
      };
      setError(error);
      throw error;
    }

    setError(null);

    try {
      console.log('[TransactionManager] 💸 Executing native transfer');
      console.log('[TransactionManager] To:', to);
      console.log('[TransactionManager] Value:', value);
      
      const tx = {
        to,
        value: typeof value === "string" && !value.includes(".") 
          ? BigInt(value) 
          : parseEther(value),
      };

      if (gasLimit) {
        tx.gasLimit = BigInt(gasLimit);
      }

      console.log('[TransactionManager] 🚀 Sending transaction...');
      const transaction = await signer.sendTransaction(tx);
      console.log('[TransactionManager] ✅ Transaction submitted:', transaction.hash);

      setError(null);
      return { hash: transaction.hash };
    } catch (err) {
      console.error("[TransactionManager] ❌ Native transfer failed:", err);
      const parsedError = parseErrorMessage(err);
      setError(parsedError);
      throw parsedError;
    }
  }

  // Clear error manually if needed
  const clearError = () => setError(null);

  return {
    estimateGas,
    executeTransaction,
    executeNativeTransfer,
    gasInfo,
    isEstimating,
    error,
    clearError,
  };
}