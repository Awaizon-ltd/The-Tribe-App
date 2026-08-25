import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const SplashScreen = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  // Animation values
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const floatAnimation = useRef(new Animated.Value(0)).current;
  const rotateAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Shimmer wave effect
    Animated.loop(
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Floating effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnimation, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimation, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotation effect
    Animated.loop(
      Animated.timing(rotateAnimation, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();

    // Scale pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Wave effect
    Animated.loop(
      Animated.timing(waveAnimation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const shimmerTranslate = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 2, width * 2],
  });

  const floatY = floatAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  const rotate = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scale = scaleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const waveOpacity = waveAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  // Enhanced Skeleton with gradient shimmer
  const SkeletonBox = ({ 
    width: boxWidth, 
    height, 
    style, 
    variant = 'default',
    delay = 0,
    animated = true
  }) => {
    const fadeIn = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.spring(fadeIn, {
        toValue: 1,
        delay,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }, [delay]);

    const getVariantStyle = () => {
      switch (variant) {
        case 'circle':
          return { borderRadius: boxWidth / 2 };
        case 'rounded':
          return { borderRadius: theme.BORDER_RADIUS.xl };
        case 'card':
          return { borderRadius: theme.BORDER_RADIUS.lg };
        default:
          return { borderRadius: theme.BORDER_RADIUS.sm };
      }
    };

    return (
      <Animated.View
        style={[
          styles.skeletonBox,
          { 
            width: boxWidth, 
            height,
            opacity: fadeIn,
            transform: animated ? [
              { scale: fadeIn },
              { translateY: floatY }
            ] : [{ scale: fadeIn }],
          },
          getVariantStyle(),
          style,
        ]}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateX: shimmerTranslate }],
          }}
        >
          <LinearGradient
            colors={[
              'transparent',
              `${theme.COLORS.primary}15`,
              `${theme.COLORS.primary}30`,
              `${theme.COLORS.primary}15`,
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, width: width * 2 }}
          />
        </Animated.View>
      </Animated.View>
    );
  };

  // Animated floating orbs in background
  const FloatingOrb = ({ size, delay, duration, left, top }) => {
    const orbFloat = useRef(new Animated.Value(0)).current;
    const orbOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(orbFloat, {
              toValue: 1,
              duration: duration || 4000,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(orbOpacity, {
              toValue: 1,
              duration: 1000,
              delay,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(orbFloat, {
              toValue: 0,
              duration: duration || 4000,
              useNativeDriver: true,
            }),
            Animated.timing(orbOpacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }, []);

    const translateY = orbFloat.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -100],
    });

    return (
      <Animated.View
        style={[
          styles.floatingOrb,
          {
            width: size,
            height: size,
            left,
            top,
            opacity: orbOpacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <LinearGradient
          colors={[`${theme.COLORS.primary}40`, `${theme.COLORS.primary}10`]}
          style={{ flex: 1, borderRadius: size / 2 }}
        />
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Animated Background */}
      <Animated.View
        style={[
          styles.backgroundGradient,
          { transform: [{ rotate }], opacity: 0.5 }
        ]}
      >
        <LinearGradient
          colors={[
            `${theme.COLORS.primary}15`,
            theme.COLORS.background,
            `${theme.COLORS.primary}10`,
            theme.COLORS.background,
          ]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Floating Orbs */}
      <FloatingOrb size={120} delay={0} duration={5000} left="10%" top="15%" />
      <FloatingOrb size={80} delay={500} duration={6000} left="70%" top="25%" />
      <FloatingOrb size={100} delay={1000} duration={5500} left="30%" top="60%" />
      <FloatingOrb size={60} delay={1500} duration={4500} left="80%" top="70%" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header with Glassmorphism */}
        <Animated.View style={[styles.header, { transform: [{ scale }] }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <SkeletonBox 
                width={48} 
                height={48} 
                variant="circle"
                delay={0}
              />
              <View>
                <SkeletonBox 
                  width={120} 
                  height={22}
                  delay={50}
                  style={styles.mb8}
                />
                <SkeletonBox 
                  width={80} 
                  height={14}
                  delay={100}
                />
              </View>
            </View>
            <View style={styles.headerRight}>
              <SkeletonBox 
                width={44} 
                height={44} 
                variant="rounded"
                delay={150}
              />
              <SkeletonBox 
                width={44} 
                height={44} 
                variant="rounded"
                delay={200}
              />
            </View>
          </View>
        </Animated.View>

        {/* Hero Card with Glow Effect */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              transform: [{ scale }, { translateY: floatY }],
            },
          ]}
        >
          <LinearGradient
            colors={[`${theme.COLORS.primary}20`, `${theme.COLORS.surface}FF`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <SkeletonBox 
              width="100%" 
              height={200}
              variant="card"
              delay={250}
              animated={false}
            />
            <View style={styles.heroContent}>
              <SkeletonBox 
                width="80%" 
                height={32}
                delay={300}
                style={styles.mb12}
              />
              <SkeletonBox 
                width="60%" 
                height={18}
                delay={350}
                style={styles.mb16}
              />
              <View style={styles.heroActions}>
                <SkeletonBox 
                  width={120} 
                  height={44}
                  variant="rounded"
                  delay={400}
                />
                <SkeletonBox 
                  width={100} 
                  height={44}
                  variant="rounded"
                  delay={450}
                />
              </View>
            </View>
          </LinearGradient>
          
          {/* Glow effect */}
          <Animated.View
            style={[
              styles.heroGlow,
              { opacity: waveOpacity }
            ]}
          />
        </Animated.View>

        {/* Dynamic Stats Grid */}
        <View style={styles.statsGrid}>
          {[0, 1, 2, 3].map((item) => (
            <Animated.View
              key={item}
              style={[
                styles.statCard,
                {
                  transform: [
                    { scale },
                    { 
                      translateY: floatAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8 - (item * 2)],
                      })
                    }
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[`${theme.COLORS.primary}10`, theme.COLORS.surface]}
                style={styles.statGradient}
              >
                <SkeletonBox 
                  width={56} 
                  height={56} 
                  variant="rounded"
                  delay={500 + item * 50}
                  style={styles.mb12}
                />
                <SkeletonBox 
                  width="90%" 
                  height={24}
                  delay={550 + item * 50}
                  style={styles.mb8}
                />
                <SkeletonBox 
                  width="70%" 
                  height={14}
                  delay={600 + item * 50}
                />
              </LinearGradient>
            </Animated.View>
          ))}
        </View>

        {/* Section Header with Action */}
        <View style={styles.sectionHeader}>
          <View>
            <SkeletonBox 
              width={200} 
              height={28}
              delay={800}
              style={styles.mb8}
            />
            <SkeletonBox 
              width={140} 
              height={16}
              delay={850}
            />
          </View>
          <SkeletonBox 
            width={90} 
            height={40}
            variant="rounded"
            delay={900}
          />
        </View>

        {/* Modern Card Grid with Hover Effect */}
        <View style={styles.cardGrid}>
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Animated.View
              key={item}
              style={[
                styles.modernCard,
                {
                  transform: [
                    { 
                      scale: scaleAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, item % 2 === 0 ? 1.03 : 1.02],
                      })
                    },
                    { 
                      translateY: floatAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, item % 2 === 0 ? -10 : -5],
                      })
                    }
                  ],
                },
              ]}
            >
              <SkeletonBox 
                width="100%" 
                height={160}
                variant="card"
                delay={950 + item * 80}
              />
              <View style={styles.cardInfo}>
                <View style={styles.cardHeader}>
                  <SkeletonBox 
                    width={32} 
                    height={32} 
                    variant="circle"
                    delay={1000 + item * 80}
                  />
                  <SkeletonBox 
                    width={40} 
                    height={24}
                    variant="rounded"
                    delay={1050 + item * 80}
                  />
                </View>
                <SkeletonBox 
                  width="90%" 
                  height={20}
                  delay={1100 + item * 80}
                  style={styles.mb8}
                />
                <SkeletonBox 
                  width="70%" 
                  height={16}
                  delay={1150 + item * 80}
                  style={styles.mb12}
                />
                <View style={styles.cardFooter}>
                  <View style={styles.cardTags}>
                    <SkeletonBox 
                      width={50} 
                      height={22}
                      variant="rounded"
                      delay={1200 + item * 80}
                    />
                    <SkeletonBox 
                      width={60} 
                      height={22}
                      variant="rounded"
                      delay={1250 + item * 80}
                    />
                  </View>
                  <SkeletonBox 
                    width={28} 
                    height={28}
                    variant="circle"
                    delay={1300 + item * 80}
                  />
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Feature Highlights */}
        <View style={styles.featureSection}>
          <SkeletonBox 
            width={180} 
            height={28}
            delay={1800}
            style={styles.mb16}
          />
          {[0, 1, 2].map((item) => (
            <Animated.View
              key={item}
              style={[
                styles.featureCard,
                {
                  transform: [
                    { scale },
                    { translateY: floatY }
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  `${theme.COLORS.primary}08`,
                  theme.COLORS.surface
                ]}
                style={styles.featureGradient}
              >
                <SkeletonBox 
                  width={64} 
                  height={64}
                  variant="rounded"
                  delay={1850 + item * 100}
                />
                <View style={styles.featureInfo}>
                  <SkeletonBox 
                    width="80%" 
                    height={22}
                    delay={1900 + item * 100}
                    style={styles.mb8}
                  />
                  <SkeletonBox 
                    width="95%" 
                    height={16}
                    delay={1950 + item * 100}
                    style={styles.mb6}
                  />
                  <SkeletonBox 
                    width="85%" 
                    height={16}
                    delay={2000 + item * 100}
                  />
                </View>
                <SkeletonBox 
                  width={32} 
                  height={32}
                  variant="circle"
                  delay={2050 + item * 100}
                />
              </LinearGradient>
            </Animated.View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    backgroundGradient: {
      position: 'absolute',
      width: width * 2,
      height: height * 2,
      top: -height / 2,
      left: -width / 2,
    },
    floatingOrb: {
      position: 'absolute',
      borderRadius: 999,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: theme.SPACING.xl * 3,
    },
    
    // Header
    header: {
      margin: theme.SPACING.lg,
      marginTop: theme.SPACING.md,
      backgroundColor: `${theme.COLORS.surface}F0`,
      borderRadius: theme.BORDER_RADIUS.xl,
      padding: theme.SPACING.lg,
      borderWidth: 1,
      borderColor: `${theme.COLORS.border}80`,
      ...theme.SHADOWS.medium,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.md,
    },
    headerRight: {
      flexDirection: 'row',
      gap: theme.SPACING.sm,
    },

    // Hero Card
    heroCard: {
      marginHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.xl,
      borderRadius: theme.BORDER_RADIUS.xl,
      overflow: 'hidden',
      ...theme.SHADOWS.large,
      position: 'relative',
    },
    heroGradient: {
      borderRadius: theme.BORDER_RADIUS.xl,
      overflow: 'hidden',
    },
    heroContent: {
      padding: theme.SPACING.lg,
    },
    heroActions: {
      flexDirection: 'row',
      gap: theme.SPACING.md,
    },
    heroGlow: {
      position: 'absolute',
      top: -50,
      left: -50,
      right: -50,
      bottom: -50,
      backgroundColor: `${theme.COLORS.primary}30`,
      filter: 'blur(40px)',
      zIndex: -1,
    },

    // Stats Grid
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.SPACING.md,
      paddingHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.xl,
    },
    statCard: {
      width: (width - theme.SPACING.lg * 2 - theme.SPACING.md) / 2,
      borderRadius: theme.BORDER_RADIUS.lg,
      overflow: 'hidden',
      ...theme.SHADOWS.small,
    },
    statGradient: {
      padding: theme.SPACING.lg,
      alignItems: 'center',
      borderRadius: theme.BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: `${theme.COLORS.border}60`,
    },

    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.lg,
    },

    // Modern Card Grid
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.SPACING.md,
      paddingHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.xl,
    },
    modernCard: {
      width: (width - theme.SPACING.lg * 2 - theme.SPACING.md) / 2,
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      ...theme.SHADOWS.small,
    },
    cardInfo: {
      padding: theme.SPACING.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.SPACING.sm,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTags: {
      flexDirection: 'row',
      gap: theme.SPACING.xs,
    },

    // Feature Section
    featureSection: {
      paddingHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.xl,
    },
    featureCard: {
      marginBottom: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.lg,
      overflow: 'hidden',
      ...theme.SHADOWS.small,
    },
    featureGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.md,
      padding: theme.SPACING.lg,
      borderRadius: theme.BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: `${theme.COLORS.border}60`,
    },
    featureInfo: {
      flex: 1,
    },

    // Skeleton
    skeletonBox: {
      backgroundColor: theme.COLORS.surface,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: `${theme.COLORS.border}40`,
    },

    // Spacing
    mb6: { marginBottom: 6 },
    mb8: { marginBottom: theme.SPACING.xs },
    mb12: { marginBottom: theme.SPACING.sm },
    mb16: { marginBottom: theme.SPACING.md },
    bottomSpacer: { height: theme.SPACING.xl * 2 },
  });

export default SplashScreen;