import React, { useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Alert as RNAlert } from 'react-native';
import { WebView } from 'react-native-webview';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import api from '../../services/GuildApiService';
import ConfirmActionSheet from './ConfirmActionSheet';
import { BRIDGE_METHODS, MINI_APP_SDK_SOURCE } from './bridge/Protocol';

// Non-sensitive methods — resolved directly, no confirmation sheet.
// Sensitive methods (wallet.signMessage, wallet.sendTx) are handled
// separately below, since they need a passcode, not just a native object call.
const createSafeHandlers = ({ guildId, address, userProfile }) => ({
  'wallet.getAddress':  async () => address ?? null,
  'guild.getMembers':   async () => (guildId ? api.getMembers(guildId) : []),
  'guild.getInfo':      async () => (guildId ? api.getGuild(guildId) : null),
  'chat.sendMessage':   async ({ text }) => {
    if (!guildId) throw new Error('No guild context for this mini-app');
    return api.sendMessage(guildId, { text });
  },
  'user.getProfile':    async () => userProfile,
  'ui.showToast':       async ({ message }) => { RNAlert.alert(message); return true; },
  'ui.close':            async () => true, // handled by parent screen via onClose prop, see below
});

const MiniAppWebView = ({ miniApp, guildId, grantedScopes, userProfile, onClose }) => {
  const { address, createSignerForTransaction, hasLocalPasscode } = useWallet();
  const webViewRef = useRef(null);
  const [pendingConfirm, setPendingConfirm] = useState(null); // { id, method, params }

  const safeHandlers = createSafeHandlers({ guildId, address, userProfile });

  const sendResponse = useCallback((id, error, result) => {
    webViewRef.current?.injectJavaScript(
      `window.__onBridgeResponse(${id}, ${error ? JSON.stringify(error) : 'null'}, ${JSON.stringify(result ?? null)}); true;`
    );
  }, []);

  const executeSafe = useCallback(async (id, method, params) => {
    try {
      const result = await safeHandlers[method](params);
      sendResponse(id, null, result);
    } catch (err) {
      sendResponse(id, err.message || 'Bridge call failed', null);
    }
  }, [safeHandlers, sendResponse]);

  // Sensitive methods run only after the user enters their passcode in
  // ConfirmActionSheet. This is the one path that ever touches signing.
  const executeSensitive = useCallback(async (method, params, passcode) => {
    if (!hasLocalPasscode) {
      throw new Error('Set up a wallet passcode before using this feature');
    }
    const signer = await createSignerForTransaction(passcode); // throws on wrong passcode

    if (method === 'wallet.signMessage') {
      return signer.signMessage(params.message);
    }

    if (method === 'wallet.sendTx') {
      // Native-coin send only for now. ERC20/token sends need a contract
      // call built from the token's address/decimals — not wired up yet;
      // extend here (using Contract(tokenAddress, ERC20_ABI, signer).transfer(...))
      // once mini-apps need token transfers rather than native currency.
      if (params.token && params.token !== 'native') {
        throw new Error(`Token transfers not yet supported (requested: ${params.token})`);
      }
      const tx = await signer.sendTransaction({
        to: params.to,
        value: ethers.parseEther(String(params.amount)),
      });
      return { hash: tx.hash };
    }

    throw new Error(`Unhandled sensitive method: ${method}`);
  }, [hasLocalPasscode, createSignerForTransaction]);

  const onMessage = useCallback((event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return; // ignore malformed messages
    }
    const { id, method, params } = msg;
    const methodDef = BRIDGE_METHODS[method];

    if (!methodDef) {
      sendResponse(id, `Unknown method: ${method}`, null);
      return;
    }
    if (!grantedScopes.includes(methodDef.scope)) {
      sendResponse(id, `Permission denied: ${methodDef.scope}`, null);
      return;
    }
    if (methodDef.requiresConfirmation) {
      setPendingConfirm({ id, method, params });
      return;
    }
    executeSafe(id, method, params);
  }, [grantedScopes, executeSafe, sendResponse]);

  const handleConfirm = useCallback(async (passcode) => {
    const { id, method, params } = pendingConfirm;
    const result = await executeSensitive(method, params, passcode);
    // Only clear the sheet (and thus the passcode field) once the signer
    // call actually succeeds — on failure ConfirmActionSheet shows the
    // error and lets the user retry without losing the pending request.
    setPendingConfirm(null);
    sendResponse(id, null, result);
  }, [pendingConfirm, executeSensitive, sendResponse]);

  const handleReject = useCallback(() => {
    sendResponse(pendingConfirm.id, 'User rejected', null);
    setPendingConfirm(null);
  }, [pendingConfirm, sendResponse]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: miniApp.url }}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={MINI_APP_SDK_SOURCE}
        originWhitelist={[miniApp.originWhitelist]}
        javaScriptEnabled
      />
      {pendingConfirm && (
        <ConfirmActionSheet
          visible
          method={pendingConfirm.method}
          params={pendingConfirm.params}
          appName={miniApp.name}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default MiniAppWebView;