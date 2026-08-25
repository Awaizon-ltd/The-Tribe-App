// components/common/UserIcon.js
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Image, View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserData } from '../../contexts/UserDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import UserLogo from '../../assets/default-icon.png';

const STORAGE_KEY = 'USER_PROFILE_IMAGE';

// ── Ring geometry ─────────────────────────────────────────────────────────
const AVATAR_SIZE   = 40;
const RING_PADDING   = 3;   // gap between avatar edge and ring
const STROKE_WIDTH   = 2.5;
const SEGMENTS        = 4;
const GAP_DEGREES     = 22; // visual gap between each of the 4 arcs

const RING_SIZE = AVATAR_SIZE + RING_PADDING * 2 + STROKE_WIDTH * 2;
const RADIUS    = (RING_SIZE - STROKE_WIDTH) / 2;
const CENTER    = RING_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const GAP_LENGTH     = (GAP_DEGREES / 360) * CIRCUMFERENCE;
const SEGMENT_LENGTH = CIRCUMFERENCE / SEGMENTS - GAP_LENGTH;
const DASH_ARRAY = `${SEGMENT_LENGTH} ${GAP_LENGTH}`;

const UserIcon = ({ onPress, size = AVATAR_SIZE, ringColor }) => {
  const { userData } = useUserData();
  const { COLORS } = useTheme();
  const [imageUri, setImageUri] = useState(null);

  const stroke = ringColor || COLORS.primary;

  // Load cached image
  useEffect(() => {
    const loadCachedImage = async () => {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        setImageUri(cached);
      }
    };
    loadCachedImage();
  }, []);

  // Update when Firestore image changes
  useEffect(() => {
    if (userData?.profilePicture) {
      setImageUri(userData.profilePicture);
      AsyncStorage.setItem(STORAGE_KEY, userData.profilePicture);
    }
  }, [userData?.profilePicture]);

  // Scale ring geometry if a custom size is passed
  const scale = size / AVATAR_SIZE;
  const ringSize = RING_SIZE * scale;

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.75}>
      <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
        {/* 4-segment ring */}
        <Svg
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={StyleSheet.absoluteFill}
        >
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={stroke}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={DASH_ARRAY}
            strokeLinecap="round"
            fill="none"
            // rotate so a gap sits at the top instead of a segment seam
            rotation={-90 + GAP_DEGREES / 2}
            origin={`${CENTER}, ${CENTER}`}
          />
        </Svg>

        {/* Avatar, inset within the ring */}
        <Image
          source={imageUri ? { uri: imageUri } : UserLogo}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </View>
    </TouchableOpacity>
  );
};

export default UserIcon;

const styles = StyleSheet.create({
  container: {
    marginLeft: 0,
  },
});