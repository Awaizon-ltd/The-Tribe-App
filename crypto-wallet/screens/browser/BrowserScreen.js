import React, { useState, useRef, useCallback } from "react";
import { WebView } from "react-native-webview";
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Modal,
  ScrollView,
  SafeAreaView,
  BackHandler,
  RefreshControl,
  Linking,
  ActivityIndicator,
  Platform,
  ImageBackground,
  Dimensions,
  Animated,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

const { width: screenWidth } = Dimensions.get("window");

const BrowserScreen = () => {
  const [url, setUrl] = useState("https://sushi.com");
  const [inputUrl, setInputUrl] = useState(url);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentTitle, setCurrentTitle] = useState("SysFi DAO");
  const webviewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Handle Android Back Press
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isFullScreen && webviewRef.current) {
          webviewRef.current.injectJavaScript(`
            (function() {
              if (window.history.length <= 1) {
                window.ReactNativeWebView.postMessage("EXIT_FULLSCREEN");
              } else {
                window.history.back();
              }
            })();
            true;
          `);
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => backHandler.remove();
    }, [isFullScreen]),
  );

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (webviewRef.current) {
          webviewRef.current.goBack();
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, []);

  const onShouldStartLoadWithRequest = ({ url }) => {
    if (
      url.startsWith("wc:") ||
      url.startsWith("metamask:") ||
      url.startsWith("trust:") ||
      url.startsWith("intent://") ||
      url.includes("walletconnect")
    ) {
      Linking.openURL(url).catch(console.warn);
      return false;
    }
    return true;
  };

  const onMessage = (event) => {
    const message = event.nativeEvent.data;

    if (message === "EXIT_FULLSCREEN") {
      setIsFullScreen(false);
      return;
    }

    try {
      const parsed = JSON.parse(message);
      console.log("Web3 message:", parsed);
    } catch (e) {
      console.log("Raw WebView message:", message);
    }
  };

  const injectedJS = `
    (function() {
      if (window.ethereum) {
        ethereum.on('connect', function(info) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'connect', info }));
        });
        ethereum.on('disconnect', function(error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'disconnect', error }));
        });
        ethereum.on('chainChanged', function(chainId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chainChanged', chainId }));
        });
      }
      
      // Send page title updates
      const observer = new MutationObserver(function(mutations) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'titleChange', 
          title: document.title 
        }));
      });
      observer.observe(document.querySelector('title'), { childList: true });
    })();
  `;

  const handleGoPress = () => {
    let formattedUrl = inputUrl;
    if (!formattedUrl.startsWith("http")) {
      formattedUrl = `https://${formattedUrl}`;
    }
    setUrl(formattedUrl);
    setIsFullScreen(true);

    // Animate transition
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    webviewRef.current?.reload();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const openPage = (pageUrl) => {
    setInputUrl(pageUrl);
    setUrl(pageUrl);
    setIsModalVisible(false);
  };

  const resetBrowser = () => {
    setUrl("https://sushi.com");
    setInputUrl("https://sushi.com");
    setIsFullScreen(false);
    setCurrentTitle("Sushi");
  };

  const dAppSections = {
    "🎨 NFT Marketplaces": [
      {
        name: "OpenSea",
        url: "https://opensea.io",
        logo: require("../../assets/opensea.png"),
        description: "Leading NFT marketplace",
        gradient: ["#2081E2", "#1868B7"],
      },
      {
        name: "Blur",
        url: "https://blur.io",
        logo: require("../../assets/blur.png"),
        description: "Pro trader marketplace",
        gradient: ["#FF8A00", "#FF6B00"],
      },
      {
        name: "Magic Eden",
        url: "https://magiceden.io",
        logo: require("../../assets/magic.png"),
        description: "Multi-chain NFTs",
        gradient: ["#E42575", "#C71585"],
      },
    ],
    "🔄 DEX Trading": [
      {
        name: "sushi Swap",
        url: "https://sushi.com",
        logo: require("../../assets/sushi.jpg"),
        description: "Ethereum DEX leader",
        gradient: ["#FF007A", "#FF6EC7"],
      },
      {
        name: "QuickSwap",
        url: "https://dapp.quickswap.exchange/",
        logo: require("../../assets/quickswap.png"),
        description: "Polygon trading",
        gradient: ["#448AFF", "#2979FF"],
      },
      {
        name: "PancakeSwap",
        url: "https://pancakeswap.finance",
        logo: require("../../assets/pancake.png"),
        description: "BSC DeFi hub",
        gradient: ["#1FC7D4", "#7645D9"],
      },
    ],
    "📊 Market Data": [
      {
        name: "CoinGecko",
        url: "https://coingecko.com",
        logo: require("../../assets/gecko.png"),
        description: "Comprehensive data",
        gradient: ["#8DC647", "#58CC02"],
      },
      {
        name: "CoinMarketCap",
        url: "https://coinmarketcap.com",
        logo: require("../../assets/cmc.png"),
        description: "Market cap leader",
        gradient: ["#17D1AA", "#00D4AA"],
      },
    ],
    "📈 DEX Analytics": [
      {
        name: "GeckoTerminal",
        url: "https://www.geckoterminal.com",
        logo: require("../../assets/terminal.png"),
        description: "Live DEX data",
        gradient: ["#8DC647", "#58CC02"],
      },
      {
        name: "DexScreener",
        url: "https://dexscreener.com/",
        logo: require("../../assets/dex.png"),
        description: "Token analytics",
        gradient: ["#00D2FF", "#3A7BD5"],
      },
    ],
  };

  const filteredSections = searchText
    ? Object.fromEntries(
        Object.entries(dAppSections)
          .map(([section, dApps]) => [
            section,
            dApps.filter(
              (dApp) =>
                dApp.name.toLowerCase().includes(searchText.toLowerCase()) ||
                dApp.description
                  .toLowerCase()
                  .includes(searchText.toLowerCase()),
            ),
          ])
          .filter(([_, dApps]) => dApps.length > 0),
      )
    : dAppSections;

  const renderDAppTile = (dApp, index) => (
    <TouchableOpacity
      key={index}
      style={[styles.modernTile]}
      onPress={() => {
        setUrl(dApp.url);
        setInputUrl(dApp.url);
        setIsFullScreen(true);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.tileContent}>
        <View style={styles.logoContainer}>
          <Image source={dApp.logo} style={styles.modernLogo} />
          <View style={[styles.logoGlow, { shadowColor: dApp.gradient[0] }]} />
        </View>
        <Text style={styles.modernTileText} numberOfLines={1}>
          {dApp.name}
        </Text>
        <Text style={styles.tileDescription} numberOfLines={2}>
          {dApp.description}
        </Text>
      </View>
      <View style={[styles.tileGradient, { opacity: 0.1 }]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0a0a0a" />

      {isFullScreen ? (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          {/* Modern Header for WebView */}
          {/* <View style={styles.webViewHeader}>
            <TouchableOpacity
              onPress={() => webviewRef.current?.goBack()}
              style={styles.headerButton}
            >
              <Icon name="arrow-back" size={22} color="#26cc6b" />
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle} numberOfLines={1}>
                {currentTitle}
              </Text>
              <Text style={styles.pageUrl} numberOfLines={1}>
                {new URL(url).hostname}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => webviewRef.current?.reload()}
                style={styles.headerButton}
              >
                <Icon name="refresh" size={22} color="#26cc6b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={resetBrowser}
                style={styles.headerButton}
              >
                <Icon name="apps" size={22} color="#26cc6b" />
              </TouchableOpacity>
            </View>
          </View> */}

          <WebView
            source={{ uri: url }}
            ref={webviewRef}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            injectedJavaScriptBeforeContentLoaded={injectedJS}
            onMessage={(event) => {
              onMessage(event);
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "titleChange") {
                  setCurrentTitle(data.title);
                }
              } catch (e) {}
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            startInLoadingState
            allowsLinkPreview
            allowsInlineMediaPlaybook
            mixedContentMode="always"
          />
        </Animated.View>
      ) : (
        <ScrollView
          style={styles.homeContainer}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Enhanced Hero Banner */}
          <TouchableOpacity
            onPress={() => {
              setUrl("https://sysfidao.network");
              setInputUrl("https://sysfidao.network");
              setIsFullScreen(true);
            }}
            style={styles.heroBanner}
            activeOpacity={0.9}
          >
            <ImageBackground
              source={require("../../assets/header.jpg")}
              style={styles.heroImage}
              imageStyle={styles.heroImageStyle}
            >
              <View style={styles.heroOverlay}>
                <Text style={styles.heroTitle}>SysFi Network</Text>
                <Text style={styles.heroSubtitle}>
                  Decentralized Finance Ecosystem
                </Text>
                <View style={styles.heroButton}>
                  <Text style={styles.heroButtonText}>Explore Now</Text>
                  <Icon name="arrow-forward" size={18} color="#fff" />
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          {/* Modern Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Icon
                name="search"
                size={20}
                color="#666"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search dApps..."
                placeholderTextColor="#666"
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText ? (
                <TouchableOpacity
                  onPress={() => setSearchText("")}
                  style={styles.clearButton}
                >
                  <Icon name="clear" size={18} color="#666" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Enhanced dApp Sections */}
          {Object.entries(filteredSections).map(([section, dApps]) => (
            <View key={section} style={styles.section}>
              <View style={styles.sectionHeaderContainer}>
                <Text style={styles.modernSectionHeader}>{section}</Text>
                <Text style={styles.sectionCount}>{dApps.length}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalGrid}
                decelerationRate="fast"
                snapToInterval={140}
              >
                {dApps.map(renderDAppTile)}
              </ScrollView>
            </View>
          ))}

          {/* Quick Stats Section */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>Quick Access</Text>
            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => {
                  setUrl("https://app.sysfidao.network");
                  setIsFullScreen(true);
                }}
              >
                <Icon name="dashboard" size={24} color="#26cc6b" />
                <Text style={styles.statText}>Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                onPress={() => {
                  setUrl("https://coingecko.com");
                  setIsFullScreen(true);
                }}
              >
                <Icon name="trending-up" size={24} color="#26cc6b" />
                <Text style={styles.statText}>Markets</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                onPress={() => {
                  setUrl("https://app.uniswap.org");
                  setIsFullScreen(true);
                }}
              >
                <Icon name="swap-horiz" size={24} color="#26cc6b" />
                <Text style={styles.statText}>Trade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Enhanced Bottom Navigation */}
      <View style={styles.modernUrlBar}>
        <TouchableOpacity
          onPress={() => webviewRef.current?.goBack()}
          style={[styles.navButton, !isFullScreen && styles.disabledButton]}
          disabled={!isFullScreen}
        >
          <Icon
            name="arrow-back"
            size={20}
            color={isFullScreen ? "#26cc6b" : "#444"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => webviewRef.current?.goForward()}
          style={[styles.navButton, !isFullScreen && styles.disabledButton]}
          disabled={!isFullScreen}
        >
          <Icon
            name="arrow-forward"
            size={20}
            color={isFullScreen ? "#26cc6b" : "#444"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => webviewRef.current?.reload()}
          style={[styles.navButton, !isFullScreen && styles.disabledButton]}
          disabled={!isFullScreen}
        >
          <Icon
            name="refresh"
            size={20}
            color={isFullScreen ? "#26cc6b" : "#444"}
          />
        </TouchableOpacity>

        <TextInput
          style={[styles.modernInput, isInputFocused && styles.inputFocused]}
          onChangeText={setInputUrl}
          value={inputUrl}
          onSubmitEditing={handleGoPress}
          keyboardType="url"
          returnKeyType="go"
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          placeholder="Enter URL..."
          placeholderTextColor="#666"
        />

        <TouchableOpacity onPress={resetBrowser} style={styles.navButton}>
          <Icon name="apps" size={24} color="#26cc6b" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },

  homeContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },

  scrollContainer: {
    paddingBottom: 100,
  },

  // WebView Header
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  titleContainer: {
    flex: 1,
    marginHorizontal: 15,
  },

  pageTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  pageUrl: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },

  headerActions: {
    flexDirection: "row",
  },

  headerButton: {
    padding: 8,
    marginHorizontal: 4,
  },

  // Hero Banner
  heroBanner: {
    margin: 15,
    marginTop: 10,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#26cc6b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  heroImage: {
    height: 200,
    justifyContent: "flex-end",
  },

  heroImageStyle: {
    borderRadius: 16,
  },

  heroOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },

  heroSubtitle: {
    color: "#ccc",
    fontSize: 16,
    marginBottom: 15,
  },

  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#26cc6b",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignSelf: "flex-start",
  },

  heroButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },

  // Search Bar
  searchContainer: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 48,
    borderWidth: 1,
    borderColor: "#333",
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },

  clearButton: {
    padding: 5,
  },

  // Sections
  section: {
    marginBottom: 25,
  },

  sectionHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 15,
  },

  modernSectionHeader: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },

  sectionCount: {
    color: "#666",
    fontSize: 14,
    backgroundColor: "#222",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  horizontalGrid: {
    paddingLeft: 15,
    paddingRight: 5,
  },

  // Modern Tiles
  modernTile: {
    width: 130,
    height: 140,
    backgroundColor: "#1a1a1a",
    marginRight: 15,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#333",
    position: "relative",
    overflow: "hidden",
  },

  tileContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },

  logoContainer: {
    position: "relative",
    marginBottom: 8,
  },

  modernLogo: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },

  logoGlow: {
    position: "absolute",
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 17,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },

  modernTileText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  tileDescription: {
    color: "#888",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
  },

  tileGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#26cc6b",
  },

  // Stats Section
  statsSection: {
    margin: 15,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
  },

  statsTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },

  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },

  statCard: {
    alignItems: "center",
    padding: 15,
    backgroundColor: "#222",
    borderRadius: 12,
    minWidth: 80,
  },

  statText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },

  // Bottom Navigation
  modernUrlBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#111",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingBottom: Platform.OS === "ios" ? 25 : 12,
  },

  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  disabledButton: {
    opacity: 0.5,
  },

  modernInput: {
    flex: 1,
    borderColor: "#333",
    borderWidth: 1,
    height: 44,
    color: "#fff",
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 15,
    marginHorizontal: 10,
    fontSize: 16,
  },

  inputFocused: {
    borderColor: "#26cc6b",
    shadowColor: "#26cc6b",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});

export default BrowserScreen;
