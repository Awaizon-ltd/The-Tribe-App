// contexts/AppModeContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * WALLET     — pure non-custodial wallet (multi-chain, 4 tabs, no community)
 * COMMUNITY  — full app (Robinhood Chain-only, 5 tabs, DAOs / tribes)
 */
export const APP_MODES = {
  WALLET: 'wallet',
  COMMUNITY: 'community',
};

const STORAGE_KEY = '@nexus_app_mode';
const DEFAULT_MODE = APP_MODES.COMMUNITY;
const SWITCH_DELAY_MS = 3000;

const AppModeContext = createContext(null);

export const useAppMode = () => {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within AppModeProvider');
  return ctx;
};

export const AppModeProvider = ({ children }) => {
  const [mode, setModeState] = useState(DEFAULT_MODE);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingTo, setSwitchingTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // Persist & load
  // Wallet-mode toggle is disabled for now (see ProfileDrawerContent.js) —
  // the app stays on Community mode even if a device has 'wallet' persisted
  // from before. Restore `saved === APP_MODES.WALLET ||` below to bring
  // wallet-mode restoration back once the toggle is re-enabled.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (/* saved === APP_MODES.WALLET || */ saved === APP_MODES.COMMUNITY) {
          setModeState(saved);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /**
   * Switch app mode with a 3-second animated splash.
   * @param {string}   newMode      APP_MODES.WALLET | APP_MODES.COMMUNITY
   * @param {Function} afterSwitch  Optional callback invoked AFTER the mode is committed
   *                                (use to reset chain, etc.)
   */
  const setMode = useCallback((newMode, afterSwitch) => {
    if (newMode !== APP_MODES.WALLET && newMode !== APP_MODES.COMMUNITY) return;
    // Wallet-mode toggle disabled for now — the UI control that would call
    // setMode(APP_MODES.WALLET) is commented out in ProfileDrawerContent.js,
    // but guard here too so the app can't end up in wallet mode from any
    // other path. Remove this guard to re-enable switching.
    if (newMode === APP_MODES.WALLET) return;
    if (newMode === mode && !isSwitching) return; // no-op

    // Show splash immediately
    setIsSwitching(true);
    setSwitchingTo(newMode);

    // After the delay, commit the new mode
    timerRef.current = setTimeout(() => {
      setModeState(newMode);
      AsyncStorage.setItem(STORAGE_KEY, newMode).catch(console.error);
      afterSwitch?.();
      setIsSwitching(false);
      setSwitchingTo(null);
    }, SWITCH_DELAY_MS);
  }, [mode, isSwitching]);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        setMode,
        loading,
        isSwitching,
        switchingTo,
        switchDelayMs: SWITCH_DELAY_MS,
        isWalletMode: mode === APP_MODES.WALLET,
        isCommunityMode: mode === APP_MODES.COMMUNITY,
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
};
