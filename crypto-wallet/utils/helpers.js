// utils/helpers.js
import { Linking, Share, Platform, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

// ============================================================================
// DEEP LINKING CONFIGURATION
// ============================================================================

// Not currently imported anywhere (screens build invite URLs inline —
// see components/tribe/TribeSettingComponents.js and TribeTabContent.js),
// but kept correct rather than left as a landmine: prefix/domain must match
// app.json's real scheme ("thetribe") and registered associatedDomains
// ("sysfidao.com") or these links would silently fail to reopen the app.
export const DeepLinks = {
  // Base configuration
  PREFIX: "thetribe://",
  WEB_PREFIX: "https://sysfidao.com",

  // Generate app deep links
  invite: (inviteCode) => `thetribe://invite/${inviteCode}`,

  tribe: (tribeId) => `thetribe://tribe/${tribeId}`,

  dao: (daoAddress, genre = null) =>
    genre
      ? `thetribe://dao/${daoAddress}/${genre}`
      : `thetribe://dao/${daoAddress}`,

  proposal: (proposalId) => `thetribe://proposal/${proposalId}`,

  profile: (userId) => `thetribe://profile/${userId}`,

  token: (tokenAddress) => `thetribe://token/${tokenAddress}`,

  nft: (contractAddress, tokenId) =>
    `thetribe://nft/${contractAddress}/${tokenId}`,

  send: (tokenAddress, toAddress = null, amount = null) => {
    let link = `thetribe://wallet/send/${tokenAddress}`;
    if (toAddress) link += `/${toAddress}`;
    if (amount) link += `?amount=${amount}`;
    return link;
  },

  // Generate web links (for universal links/SEO)
  web: {
    invite: (inviteCode) => `https://sysfidao.com/invite/${inviteCode}`,
    tribe: (tribeId) => `https://sysfidao.com/tribe/${tribeId}`,
    dao: (daoAddress, genre = null) =>
      genre
        ? `https://sysfidao.com/dao/${daoAddress}/${genre}`
        : `https://sysfidao.com/dao/${daoAddress}`,
    proposal: (proposalId) => `https://sysfidao.com/proposal/${proposalId}`,
    profile: (userId) => `https://sysfidao.com/profile/${userId}`,
  },
};

// ============================================================================
// SHARING FUNCTIONS
// ============================================================================

/**
 * Share DAO with others
 */
export const shareDAO = async (
  daoAddress,
  chainId,
  daoName,
  daoGenre = null,
) => {
  try {
    const deepLink = DeepLinks.dao(daoAddress, daoGenre);
    const webLink = DeepLinks.web.dao(daoAddress, daoGenre);

    const message = `Check out ${daoName} on tribeapp!\n\n${Platform.OS === "web" ? webLink : deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      const result = await Share.share({
        message: message,
        title: `Join ${daoName}`,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });

      if (result.action === Share.sharedAction) {
        console.log("DAO shared successfully");
      }
    } else {
      // Web fallback - copy to clipboard
      await Clipboard.setStringAsync(webLink);
      Alert.alert(
        "Link Copied!",
        "The DAO link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing DAO:", error);

    // Fallback to clipboard
    try {
      const fallbackLink = DeepLinks.dao(daoAddress, daoGenre);
      await Clipboard.setStringAsync(fallbackLink);
      Alert.alert(
        "Link Copied",
        "Unable to share, but the link has been copied to your clipboard.",
      );
    } catch (clipboardError) {
      Alert.alert("Error", "Unable to share DAO. Please try again.");
    }
  }
};

/**
 * Share Tribe invite
 */
export const shareTribeInvite = async (inviteCode, tribeName) => {
  try {
    const deepLink = DeepLinks.invite(inviteCode);
    const webLink = DeepLinks.web.invite(inviteCode);

    const message = `Join ${tribeName} on tribeapp!\n\n${Platform.OS === "web" ? webLink : deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Share.share({
        message: message,
        title: `Join ${tribeName}`,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });
    } else {
      await Clipboard.setStringAsync(webLink);
      Alert.alert(
        "Link Copied!",
        "The invite link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing invite:", error);
    Alert.alert("Error", "Unable to share invite. Please try again.");
  }
};

/**
 * Share Tribe
 */
export const shareTribe = async (tribeId, tribeName) => {
  try {
    const deepLink = DeepLinks.tribe(tribeId);
    const webLink = DeepLinks.web.tribe(tribeId);

    const message = `Check out ${tribeName} on tribeapp!\n\n${Platform.OS === "web" ? webLink : deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Share.share({
        message: message,
        title: tribeName,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });
    } else {
      await Clipboard.setStringAsync(webLink);
      Alert.alert(
        "Link Copied!",
        "The tribe link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing tribe:", error);
    Alert.alert("Error", "Unable to share tribe. Please try again.");
  }
};

/**
 * Share user profile
 */
export const shareProfile = async (userId, username) => {
  try {
    const deepLink = DeepLinks.profile(userId);
    const webLink = DeepLinks.web.profile(userId);

    const message = `Check out ${username}'s profile on tribeapp!\n\n${Platform.OS === "web" ? webLink : deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Share.share({
        message: message,
        title: `${username}'s Profile`,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });
    } else {
      await Clipboard.setStringAsync(webLink);
      Alert.alert(
        "Link Copied!",
        "The profile link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing profile:", error);
    Alert.alert("Error", "Unable to share profile. Please try again.");
  }
};

/**
 * Share Proposal
 */
export const shareProposal = async (proposalId, proposalTitle) => {
  try {
    const deepLink = DeepLinks.proposal(proposalId);
    const webLink = DeepLinks.web.proposal(proposalId);

    const message = `Vote on "${proposalTitle}" on tribeapp!\n\n${Platform.OS === "web" ? webLink : deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Share.share({
        message: message,
        title: proposalTitle,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });
    } else {
      await Clipboard.setStringAsync(webLink);
      Alert.alert(
        "Link Copied!",
        "The proposal link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing proposal:", error);
    Alert.alert("Error", "Unable to share proposal. Please try again.");
  }
};

/**
 * Create payment request link
 */
export const createPaymentRequest = async (
  tokenAddress,
  toAddress,
  amount = null,
) => {
  try {
    const deepLink = DeepLinks.send(tokenAddress, toAddress, amount);

    await Clipboard.setStringAsync(deepLink);
    Alert.alert(
      "Payment Request Created",
      "The payment request link has been copied to your clipboard.",
    );

    return deepLink;
  } catch (error) {
    console.error("Error creating payment request:", error);
    Alert.alert("Error", "Unable to create payment request.");
    return null;
  }
};

/**
 * Share Token
 */
export const shareToken = async (tokenAddress, tokenSymbol) => {
  try {
    const deepLink = DeepLinks.token(tokenAddress);
    const message = `Check out ${tokenSymbol} on tribeapp!\n\n${deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Share.share({
        message: message,
        title: tokenSymbol,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });
    } else {
      await Clipboard.setStringAsync(deepLink);
      Alert.alert(
        "Link Copied!",
        "The token link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing token:", error);
    Alert.alert("Error", "Unable to share token.");
  }
};

/**
 * Share NFT
 */
export const shareNFT = async (contractAddress, tokenId, nftName) => {
  try {
    const deepLink = DeepLinks.nft(contractAddress, tokenId);
    const message = `Check out ${nftName} on tribeapp!\n\n${deepLink}`;

    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Share.share({
        message: message,
        title: nftName,
        url: Platform.OS === "ios" ? deepLink : undefined,
      });
    } else {
      await Clipboard.setStringAsync(deepLink);
      Alert.alert(
        "Link Copied!",
        "The NFT link has been copied to your clipboard.",
      );
    }
  } catch (error) {
    console.error("Error sharing NFT:", error);
    Alert.alert("Error", "Unable to share NFT.");
  }
};

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format address for display (0x1234...5678)
 */
export const formatAddress = (address, startChars = 6, endChars = 4) => {
  if (!address) return "N/A";
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text, successMessage = "Copied!") => {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.error("Copy failed:", error);
    return false;
  }
};

/**
 * Pulls a numeric millisecond epoch out of a post/comment/message object.
 * Every write path in this app stores `timestamp: Date.now()` (a plain
 * number) — that's the canonical field. `createdAt` also exists on these
 * documents, but it's a Mongo Date that arrives over JSON as an ISO
 * *string*, not a number — passing it straight into ms arithmetic silently
 * produces NaN or, worse, a `typeof x === 'number'` check that's always
 * false and masks the bug behind a wrong-but-plausible-looking fallback
 * (this is exactly how comments ended up permanently reading "Just now").
 * Single source of truth for "what time did this actually happen" — use
 * this instead of each screen guessing at the field/shape by hand.
 */
export const getEntityTimestamp = (entity) => {
  if (!entity) return null;
  if (typeof entity.timestamp === "number") return entity.timestamp;
  if (typeof entity.createdAt === "number") return entity.createdAt;
  if (entity.createdAt) {
    const parsed = new Date(entity.createdAt).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return null;
};

/**
 * Format time ago — "Just now" / "5m" / "3h" / "2d", then a calendar date
 * once it's a week old. Expects a millisecond epoch — matching Date.now()
 * and every `timestamp` field this app writes — not seconds. Pass a
 * post/comment/message object through getEntityTimestamp() first if you're
 * not already holding a raw number.
 *
 * This consolidates four near-identical hand-rolled copies (post cards, the
 * feed, post detail, and comments each had their own) that had already
 * drifted on the threshold for switching to a calendar date (24h in some,
 * 7d in others) for no real reason — one behavior for every timestamp in
 * the app now, not per-screen guesswork.
 */
export const formatTimeAgo = (timestampMs) => {
  if (typeof timestampMs !== "number" || isNaN(timestampMs)) return "";
  const diff = Math.max(Date.now() - timestampMs, 0);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestampMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Format number with commas
 */
export const formatNumber = (num, decimals = 2) => {
  const number = parseFloat(num);
  if (isNaN(number)) return "0";

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

/**
 * Calculate voting progress percentage
 */
export const calculateVotePercentage = (votes, totalVotes) => {
  if (!totalVotes || totalVotes === "0") return 0;
  const percentage = (parseFloat(votes) / parseFloat(totalVotes)) * 100;
  return Math.min(percentage, 100);
};

/**
 * Format voting period remaining
 */
export const formatTimeRemaining = (endTimestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = endTimestamp - now;

  if (remaining <= 0) return "Ended";

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
};

// ============================================================================
// EXPLORER FUNCTIONS
// ============================================================================

/**
 * Open block explorer for address
 */
export const openExplorer = async (explorerUrl, address) => {
  try {
    const url = `${explorerUrl}/address/${address}`;
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      console.error("Cannot open URL:", url);
    }
  } catch (error) {
    console.error("Error opening explorer:", error);
  }
};

/**
 * Open transaction in explorer
 */
export const openTransaction = async (explorerUrl, txHash) => {
  try {
    const url = `${explorerUrl}/tx/${txHash}`;
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.error("Error opening transaction:", error);
  }
};

/**
 * Open contract in explorer
 */
export const openContract = async (explorerUrl, contractAddress) => {
  try {
    const url = `${explorerUrl}/address/${contractAddress}`;
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.error("Error opening contract:", error);
  }
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate Ethereum address
 */
export const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Validate transaction hash
 */
export const isValidTxHash = (hash) => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

/**
 * Validate amount (must be positive number)
 */
export const isValidAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Deep Links
  DeepLinks,

  // Sharing
  shareDAO,
  shareTribeInvite,
  shareTribe,
  shareProfile,
  shareProposal,
  createPaymentRequest,
  shareToken,
  shareNFT,

  // Formatting
  formatAddress,
  formatTimeAgo,
  getEntityTimestamp,
  formatNumber,
  formatTimeRemaining,

  // Clipboard
  copyToClipboard,

  // Explorer
  openExplorer,
  openTransaction,
  openContract,

  // Validation
  isValidAddress,
  isValidTxHash,
  isValidAmount,

  // Voting
  calculateVotePercentage,
};
