// components/SplashScreen.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from "react-native-svg";

const { width, height } = Dimensions.get("window");

// ─── Animated SVG Circle ─────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Orbital Ring (decorative spinner around logo) ───────────────────────────
const OrbitalRing = ({ size = 140, progress, COLORS }) => {
  const circumference = Math.PI * 2 * 62; // r=62

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const primary = COLORS?.primary || "#26cc6b";
  const primaryLight = COLORS?.primaryLight || "#67f2a1";

  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={primaryLight} stopOpacity="1" />
          <Stop offset="60%" stopColor={primary} stopOpacity="1" />
          <Stop offset="100%" stopColor="#4f46e5" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="dotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={primary} stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3" />
        </LinearGradient>
      </Defs>

      {/* Static faint full ring */}
      <Circle
        cx="70"
        cy="70"
        r="62"
        stroke="#FFFFFF08"
        strokeWidth="1"
        fill="none"
      />

      {/* Animated progress arc */}
      <AnimatedCircle
        cx="70"
        cy="70"
        r="62"
        stroke="url(#ringGrad)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin="70,70"
      />

      {/* Second outer decorative ring */}
      <Circle
        cx="70"
        cy="70"
        r="66"
        stroke="url(#dotGrad)"
        strokeWidth="0.5"
        fill="none"
        strokeDasharray="2 8"
      />
    </Svg>
  );
};

// ─── Community Nodes (background decoration) ─────────────────────────────────
const NodeDots = ({ COLORS, isDark }) => {
  const primary = COLORS?.primary || "#26cc6b";
  const nodes = [
    { top: "12%", left: "8%", size: 4, opacity: 0.4 },
    { top: "18%", right: "12%", size: 3, opacity: 0.3 },
    { top: "35%", left: "4%", size: 5, opacity: 0.25 },
    { top: "65%", right: "6%", size: 4, opacity: 0.35 },
    { top: "78%", left: "10%", size: 3, opacity: 0.2 },
    { top: "88%", right: "15%", size: 5, opacity: 0.3 },
  ];

  return (
    <>
      {nodes.map((node, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: node.top,
            left: node.left,
            right: node.right,
            width: node.size,
            height: node.size,
            borderRadius: node.size / 2,
            backgroundColor: primary,
            opacity: node.opacity,
          }}
        />
      ))}
    </>
  );
};

// ─── Dot Loader ──────────────────────────────────────────────────────────────
const DotLoader = ({ color = "#26cc6b" }) => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={dotStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: color },
            {
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
              transform: [
                {
                  scale: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1.2],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});

// ─── Main Splash Screen ──────────────────────────────────────────────────────
const SplashScreen = ({
  label = "Connecting to network...",
  isError = false,
  errorMessage = "",
  isDark = true,
  COLORS = {},
}) => {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const ringProg = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 700,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringProg, {
        toValue: 1,
        duration: 1100,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(taglineFade, {
        toValue: 1,
        duration: 800,
        delay: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Ambient glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? 0.08 : 0.06, isDark ? 0.2 : 0.12],
  });

  const bg = COLORS.background || (isDark ? "#0d1017" : "#FFFFFF");
  const primary = COLORS.primary || "#26cc6b";
  const primaryLight = COLORS.primaryLight || "#67f2a1";
  const textColor = COLORS.text || (isDark ? "#FFFFFF" : "#000000");
  const textSecondary =
    COLORS.textSecondary || (isDark ? "#BBBBBB" : "#666666");
  const textTertiary = COLORS.textTertiary || (isDark ? "#888888" : "#999999");
  const surface = COLORS.surface || (isDark ? "#161b21" : "#F5F5F5");

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={bg} />

      {/* Decorative node dots */}
      <NodeDots COLORS={COLORS} isDark={isDark} />

      {/* Subtle horizontal grid lines */}
      <View style={s.grid} pointerEvents="none">
        {[...Array(8)].map((_, i) => (
          <View
            key={i}
            style={[
              s.gridLine,
              {
                top: `${i * 14}%`,
                backgroundColor: isDark ? "#FFFFFF04" : "#00000004",
              },
            ]}
          />
        ))}
      </View>

      {/* Background radial glow */}
      <Animated.View
        style={[
          s.glow,
          {
            opacity: glowOpacity,
            backgroundColor: primary,
          },
        ]}
      />
      <Animated.View
        style={[
          s.glowIndigo,
          {
            opacity: glowOpacity,
          },
        ]}
      />

      {/* ── Logo + Branding ── */}
      <Animated.View
        style={[
          s.center,
          {
            opacity: fadeIn,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        {/* Orbital ring behind logo */}
        <View style={s.logoContainer}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <OrbitalRing size={140} progress={ringProg} COLORS={COLORS} />
          </View>

          {/* Logo image — replace with your actual asset path */}
          <View
            style={[
              s.logoWrapper,
              {
                backgroundColor: isDark ? surface : "#F0FDF4",
                borderColor: isDark ? "#26cc6b22" : "#26cc6b33",
                shadowColor: primary,
              },
            ]}
          >
            <Image
              source={require("../assets/logo.png")} // ← your logo here
              style={s.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* App name block */}
        <Animated.View
          style={[
            s.nameBlock,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          {/* App name with gradient simulation via nested Text */}
          <View style={s.appNameRow}>
            <Text style={[s.appName, { color: textColor }]}>TRIBE</Text>
            <View style={[s.namePip, { backgroundColor: primary }]} />
          </View>

          {/* Subtitle */}
          <Animated.View style={{ opacity: taglineFade }}>
            <Text style={[s.subLabel, { color: primary }]}>
              Community Platform
            </Text>

            {/* Tagline with decorative lines */}
            <View style={s.taglineRow}>
              <View
                style={[
                  s.taglineLine,
                  { backgroundColor: isDark ? "#FFFFFF18" : "#00000018" },
                ]}
              />
              <Text style={[s.tagline, { color: textTertiary }]}>
                DECENTRALISED · OPEN · FREE
              </Text>
              <View
                style={[
                  s.taglineLine,
                  { backgroundColor: isDark ? "#FFFFFF18" : "#00000018" },
                ]}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* ── Bottom Status ── */}
      <Animated.View
        style={[
          s.bottom,
          { opacity: fadeIn, transform: [{ translateY: slideUp }] },
        ]}
      >
        {isError ? (
          <View style={s.errorContainer}>
            <View
              style={[s.errorBadge, { borderColor: COLORS.error || "#FF5252" }]}
            >
              <Text style={[s.errorIcon, { color: COLORS.error || "#FF5252" }]}>
                !
              </Text>
            </View>
            <Text style={[s.errorText, { color: COLORS.error || "#FF5252" }]}>
              {errorMessage}
            </Text>
          </View>
        ) : (
          <>
            <DotLoader color={primary} />
            <Text style={[s.statusText, { color: textTertiary }]}>{label}</Text>
          </>
        )}
      </Animated.View>

      {/* Version */}
      <Animated.Text
        style={[s.version, { color: textTertiary, opacity: fadeIn }]}
      >
        v1.0.0
      </Animated.Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Background glows
  glow: {
    position: "absolute",
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    top: "-15%",
    alignSelf: "center",
  },
  glowIndigo: {
    position: "absolute",
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    bottom: "-20%",
    alignSelf: "center",
    backgroundColor: "#4f46e5",
    opacity: 0.07,
  },

  // Grid
  grid: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },

  // Center content
  center: {
    alignItems: "center",
    gap: 32,
  },

  // Logo
  logoContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: 52,
    height: 52,
  },

  // Name block
  nameBlock: {
    alignItems: "center",
    gap: 6,
  },
  appNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appName: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 10,
    textAlign: "center",
    fontFamily:
      Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-condensed",
  },
  namePip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 4,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 2,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  taglineLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    maxWidth: 32,
  },
  tagline: {
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },

  // Bottom loader
  bottom: {
    position: "absolute",
    bottom: 72,
    alignItems: "center",
    gap: 14,
  },
  statusText: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Error
  errorContainer: {
    alignItems: "center",
    gap: 12,
  },
  errorBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    fontSize: 20,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },

  // Version
  version: {
    position: "absolute",
    bottom: 36,
    fontSize: 10,
    letterSpacing: 1.5,
  },
});

export default SplashScreen;
