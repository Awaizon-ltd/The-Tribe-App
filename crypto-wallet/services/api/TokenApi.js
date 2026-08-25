// services/TokenApiService.js
import axios from "axios";
import { APP_CONFIG } from "../../constants/Config";

const API_BASE_URL = APP_CONFIG.BACKEND_URL;

class TokenApiService {
  /**
   * Get all tokens
   * Matches backend route: GET /tokens
   */
  async getAllTokens() {
    try {
      console.log("[TokenApiService] Fetching all tokens...");

      const response = await axios.get(`${API_BASE_URL}/tokens`, {
        timeout: 10000,
      });

      console.log(`[TokenApiService] ✅ Fetched ${response.data.count} tokens`);
      return response.data.data || [];
    } catch (error) {
      console.error("[TokenApiService] ❌ Error fetching all tokens:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Get available chains
   * Matches backend route: GET /tokens/chains
   */
  async getChains() {
    try {
      console.log("[TokenApiService] Fetching available chains...");

      const response = await axios.get(`${API_BASE_URL}/tokens/chains`, {
        timeout: 10000,
      });

      console.log("[TokenApiService] ✅ Chains fetched");
      return response.data.data || [];
    } catch (error) {
      console.error("[TokenApiService] ❌ Error fetching chains:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Search tokens
   * Matches backend route: GET /tokens/search
   */
  async searchTokens(query, chainId = null) {
    try {
      if (!query) {
        throw new Error("Query parameter is required");
      }

      console.log(
        `[TokenApiService] Searching tokens for: "${query}"${chainId ? ` on chain ${chainId}` : ""}...`,
      );

      const params = new URLSearchParams({
        query: query,
      });

      if (chainId !== null && chainId !== undefined) {
        params.append("chainId", chainId.toString());
      }

      const response = await axios.get(
        `${API_BASE_URL}/tokens/search?${params.toString()}`,
        { timeout: 10000 },
      );

      console.log(`[TokenApiService] ✅ Found ${response.data.count} tokens`);
      return response.data.data || [];
    } catch (error) {
      console.error("[TokenApiService] ❌ Error searching tokens:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Get tokens by chain ID
   * Matches backend route: GET /tokens/chain/:chainId
   */
  async getTokensByChain(chainId) {
    try {
      console.log(`[TokenApiService] Fetching tokens for chain ${chainId}...`);

      const response = await axios.get(
        `${API_BASE_URL}/tokens/chain/${chainId}`,
        { timeout: 10000 },
      );

      console.log(
        `[TokenApiService] ✅ Fetched ${response.data.count} tokens for chain ${chainId}`,
      );
      return response.data.data || [];
    } catch (error) {
      console.error(
        "[TokenApiService] ❌ Error fetching tokens by chain:",
        error,
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get tokens by chain name
   * Matches backend route: GET /tokens/chain/name/:chainName
   */
  async getTokensByChainName(chainName) {
    try {
      console.log(
        `[TokenApiService] Fetching tokens for chain ${chainName}...`,
      );

      const response = await axios.get(
        `${API_BASE_URL}/tokens/chain/name/${chainName}`,
        { timeout: 10000 },
      );

      console.log(
        `[TokenApiService] ✅ Fetched ${response.data.count} tokens for ${chainName}`,
      );
      return response.data.data || [];
    } catch (error) {
      console.error(
        "[TokenApiService] ❌ Error fetching tokens by chain name:",
        error,
      );
      throw this.handleError(error);
    }
  }

  /**
   * Find token by address on specific chain
   * Matches backend route: GET /tokens/chain/:chainId/address/:address
   */
  async getTokenByAddress(chainId, address) {
    try {
      console.log(
        `[TokenApiService] Fetching token ${address} on chain ${chainId}...`,
      );

      const response = await axios.get(
        `${API_BASE_URL}/tokens/chain/${chainId}/address/${address}`,
        { timeout: 10000 },
      );

      console.log("[TokenApiService] ✅ Token found");
      return response.data.data;
    } catch (error) {
      console.error(
        "[TokenApiService] ❌ Error fetching token by address:",
        error,
      );
      throw this.handleError(error);
    }
  }

  /**
   * Find token by symbol on specific chain
   * Matches backend route: GET /tokens/chain/:chainId/symbol/:symbol
   */
  async getTokenBySymbol(chainId, symbol) {
    try {
      console.log(
        `[TokenApiService] Fetching token with symbol ${symbol} on chain ${chainId}...`,
      );

      const response = await axios.get(
        `${API_BASE_URL}/tokens/chain/${chainId}/symbol/${symbol}`,
        { timeout: 10000 },
      );

      console.log("[TokenApiService] ✅ Token found");
      return response.data.data;
    } catch (error) {
      console.error(
        "[TokenApiService] ❌ Error fetching token by symbol:",
        error,
      );
      throw this.handleError(error);
    }
  }

  /**
   * Reload token lists
   * Matches backend route: POST /tokens/reload
   */
  async reloadTokens() {
    try {
      console.log("[TokenApiService] Reloading token lists...");

      const response = await axios.post(
        `${API_BASE_URL}/tokens/reload`,
        {},
        { timeout: 15000 },
      );

      console.log("[TokenApiService] ✅ Token lists reloaded successfully");
      return response.data;
    } catch (error) {
      console.error("[TokenApiService] ❌ Error reloading tokens:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Error handler
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText;

      console.error("[TokenApiService] Response error:", {
        status,
        message,
        data: error.response.data,
      });

      if (status === 404) {
        return new Error("Token not found");
      }
      if (status === 400) {
        return new Error(`Bad request: ${message}`);
      }
      if (status === 500) {
        return new Error("Server error - please try again later");
      }
      return new Error(`Backend error: ${message}`);
    } else if (error.request) {
      console.error("[TokenApiService] Network error - no response received");
      return new Error(
        "Network error: Unable to reach backend. Make sure the server is running at " +
          API_BASE_URL,
      );
    } else {
      console.error("[TokenApiService] Request error:", error.message);
      return new Error(`Error: ${error.message}`);
    }
  }
}

export default new TokenApiService();
