// constants/GenreBanners.js

// Default banner images based on genre
export const GENRE_BANNERS = {
  0: require('../assets/banners/nft.jpg'),          // NFT
  1: require('../assets/banners/game.jpg'),       // Gaming
  2: require('../assets/banners/comm.jpg'),    // Community
  3: require('../assets/banners/defi.jpg'),         // DeFi
  4: require('../assets/banners/ai.jpg'),           // AI
  5: require('../assets/banners/degen.jpg'),        // Degen
  6: require('../assets/banners/meme.jpg'),     // Memecoin
  7: require('../assets/banners/unknown.jpg'),          // RWA
  8: require('../assets/banners/unknown.jpg'),        // DePIN
  9: require('../assets/banners/unknown.jpg'),     // SocialFi
  10: require('../assets/banners/unknown.jpg'),   // Metaverse
  11: require('../assets/banners/unknown.jpg'),     // Other/Default
};

// Gradient overlays for banners
export const GENRE_GRADIENTS = {
  0: ['#8B5CF6', '#6366F1'],   // Purple gradient - NFT
  1: ['#10B981', '#059669'],   // Green gradient - Gaming
  2: ['#F59E0B', '#D97706'],   // Orange gradient - Community
  3: ['#3B82F6', '#2563EB'],   // Blue gradient - DeFi
  4: ['#EF4444', '#DC2626'],   // Red gradient - AI
  5: ['#F97316', '#EA580C'],   // Orange gradient - Degen
  6: ['#84CC16', '#65A30D'],   // Lime gradient - Memecoin
  7: ['#6366F1', '#4F46E5'],   // Indigo gradient - RWA
  8: ['#EC4899', '#DB2777'],   // Pink gradient - DePIN
  9: ['#14B8A6', '#0D9488'],   // Teal gradient - SocialFi
  10: ['#A855F7', '#9333EA'],  // Purple gradient - Metaverse
  11: ['#6B7280', '#4B5563'],  // Gray gradient - Other
};

// Get banner for genre
export const getBannerForGenre = (genreId) => {
  return GENRE_BANNERS[genreId] || GENRE_BANNERS[11];
};

// Get gradient for genre
export const getGradientForGenre = (genreId) => {
  return GENRE_GRADIENTS[genreId] || GENRE_GRADIENTS[11];
};