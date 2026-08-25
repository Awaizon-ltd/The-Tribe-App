// services/ProposalChat.js
// Proposal chat backed by MongoDB via our backend REST API.
// Replaces the Firebase Realtime Database implementation.
// The public API surface is intentionally kept identical so ProposalChatModal needs no changes.
import axios from 'axios';
import { verifyMessage } from 'ethers';
import { APP_CONFIG } from '../constants/Config';

const BASE = APP_CONFIG.BACKEND_URL;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Build the message the user must sign to authenticate for chat.
 * Returns { message, timestamp, expiresAt } — same shape as the old Firebase service.
 */
export const createAuthMessage = (daoAddress, chainId, proposalId, userAddress) => {
  const timestamp = Date.now();
  const expiresAt = timestamp + 24 * 60 * 60 * 1000; // 24 h

  return {
    message:
      `Sign this message to authenticate for proposal chat:\n\n` +
      `DAO: ${daoAddress}\nChain: ${chainId}\nProposal: ${proposalId}\n` +
      `Address: ${userAddress}\nTimestamp: ${timestamp}\nExpires: ${new Date(expiresAt).toISOString()}`,
    timestamp,
    expiresAt,
  };
};

/**
 * Client-side signature verification (matches ethers v6 API used elsewhere in the app).
 */
export const verifyAuthSignature = async (message, signature, expectedAddress) => {
  try {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
};

// ─── Message operations ───────────────────────────────────────────────────────

/**
 * Send a message.
 * Returns { id, sender, message, timestamp, ... } — matches the old Firebase shape.
 */
export const sendMessage = async (
  daoAddress,
  chainId,
  proposalId,
  messageData,
  authSignature,
  authMessage,
) => {
  try {
    const response = await axios.post(
      `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}`,
      {
        sender:        messageData.sender.toLowerCase(),
        senderName:    messageData.senderName    || null,
        senderAvatar:  messageData.senderAvatar  || null,
        message:       messageData.message.trim(),
        authSignature,
        authMessage,
        replyToId:     messageData.replyToId || null,
      },
      { timeout: 10000 },
    );

    return response.data.data;
  } catch (error) {
    console.error('[ChatService] ❌ Send failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to send message');
  }
};

/**
 * Fetch the latest N messages for a proposal.
 */
export const fetchMessages = async (
  daoAddress,
  chainId,
  proposalId,
  limit = 50,
  afterTimestamp = 0,
) => {
  try {
    if (afterTimestamp > 0) {
      const response = await axios.get(
        `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}/poll`,
        { params: { since: afterTimestamp }, timeout: 10000 },
      );
      const msgs = response.data.data || [];
      return msgs.sort((a, b) => a.timestamp - b.timestamp);
    }

    const response = await axios.get(
      `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}`,
      { params: { limit }, timeout: 10000 },
    );
    const msgs = response.data.data || [];
    return msgs.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('[ChatService] ❌ Fetch failed:', error.response?.data || error.message);
    return [];
  }
};

/**
 * Subscribe to new messages via polling every `intervalMs` milliseconds.
 * Returns an unsubscribe function — identical contract to the old Firebase listener.
 *
 * @param {string}   daoAddress
 * @param {number}   chainId
 * @param {number}   proposalId
 * @param {Function} callback      - (newMessages: Message[]) => void
 * @param {number}   afterTimestamp - Only return messages newer than this ms epoch
 * @param {number}   intervalMs     - Poll interval (default 4 000 ms)
 */
export const subscribeToMessages = (
  daoAddress,
  chainId,
  proposalId,
  callback,
  afterTimestamp = 0,
  intervalMs = 4000,
) => {
  let latestTimestamp = afterTimestamp;
  let active = true;

  const poll = async () => {
    if (!active) return;
    try {
      const response = await axios.get(
        `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}/poll`,
        { params: { since: latestTimestamp }, timeout: 8000 },
      );
      const newMessages = (response.data.data || []).sort((a, b) => a.timestamp - b.timestamp);
      if (newMessages.length > 0) {
        latestTimestamp = newMessages[newMessages.length - 1].timestamp;
        callback(newMessages);
      }
    } catch (err) {
      // Swallow poll errors — transient network issues should not kill the subscription
      console.warn('[ChatService] Poll error:', err.message);
    }
    if (active) setTimeout(poll, intervalMs);
  };

  // Start polling after a short delay so the first load (fetchMessages) completes first
  setTimeout(poll, intervalMs);

  return () => {
    active = false;
  };
};

/**
 * Get message count for a proposal.
 */
export const getMessageCount = async (daoAddress, chainId, proposalId) => {
  try {
    const response = await axios.get(
      `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}`,
      { params: { limit: 1 }, timeout: 5000 },
    );
    return response.data.count || 0;
  } catch {
    return 0;
  }
};

/**
 * Edit a message within the 5-minute window.
 */
export const editMessage = async (
  daoAddress,
  chainId,
  proposalId,
  messageId,
  newText,
  userAddress,
  authSignature,
  authMessage,
) => {
  try {
    await axios.put(
      `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}/${messageId}`,
      { sender: userAddress.toLowerCase(), authSignature, authMessage, newText },
      { timeout: 10000 },
    );
    return true;
  } catch (error) {
    console.error('[ChatService] ❌ Edit failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to edit message');
  }
};

/**
 * Soft-delete a message within the 5-minute window.
 */
export const deleteMessage = async (
  daoAddress,
  chainId,
  proposalId,
  messageId,
  userAddress,
  authSignature,
  authMessage,
) => {
  try {
    await axios.delete(
      `${BASE}/chat/${chainId}/${daoAddress}/${proposalId}/${messageId}`,
      {
        data:    { sender: userAddress.toLowerCase(), authSignature, authMessage },
        timeout: 10000,
      },
    );
    return true;
  } catch (error) {
    console.error('[ChatService] ❌ Delete failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to delete message');
  }
};
