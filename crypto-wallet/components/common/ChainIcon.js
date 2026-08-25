import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image } from 'react-native';

// ─── Deterministic avatar colours ────────────────────────────────────────────
const AVATAR_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ef4444', '#8b5cf6', '#f97316', '#06b6d4',
];
const avatarColor = (symbol) =>
  AVATAR_COLORS[(symbol?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

// ─── CoinGecko fallback — module-level cache (one fetch per coin per session) ─
const cgCache = {};

const fetchCoinGeckoLogo = async (coingeckoId) => {
  if (!coingeckoId) return null;
  if (cgCache[coingeckoId] !== undefined) return cgCache[coingeckoId];

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}` +
        `?localization=false&tickers=false&market_data=false` +
        `&community_data=false&developer_data=false`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) { cgCache[coingeckoId] = null; return null; }
    const data = await res.json();
    // prefer small (64px), fall back to thumb (24px)
    const url = data?.image?.small || data?.image?.thumb || null;
    cgCache[coingeckoId] = url;
    return url;
  } catch {
    cgCache[coingeckoId] = null;
    return null;
  }
};

/**
 * ChainIcon — renders a chain logo with a two-stage fallback:
 *   1. chain.icon  (static CDN URL stored in SUPPORTED_CHAINS)
 *   2. CoinGecko API via chain.coingeckoId  (fetched once, then cached)
 *   3. Deterministic letter avatar (always works, no network needed)
 *
 * Props:
 *   chain  { icon, coingeckoId, symbol, name }
 *   size   number (default 36)
 *   style  optional extra ViewStyle
 */
const ChainIcon = ({ chain, size = 36, style }) => {
  const [src, setSrc]           = useState(chain?.icon || null);
  const [showAvatar, setAvatar] = useState(!chain?.icon);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // When the primary URL fails → try CoinGecko → fall back to avatar
  const handleError = async () => {
    if (chain?.coingeckoId) {
      const url = await fetchCoinGeckoLogo(chain.coingeckoId);
      if (url && mounted.current) {
        setSrc(url);
        return;
      }
    }
    if (mounted.current) setAvatar(true);
  };

  const radius = size / 2;

  if (!showAvatar && src) {
    return (
      <Image
        source={{ uri: src }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
        onError={handleError}
        fadeDuration={150}
      />
    );
  }

  // Avatar fallback
  const label = (chain?.symbol || chain?.name || '??').substring(0, 2).toUpperCase();
  const bg    = avatarColor(chain?.symbol);

  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: radius,
          backgroundColor: bg,
          alignItems: 'center', justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.33, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>
        {label}
      </Text>
    </View>
  );
};

export default ChainIcon;
