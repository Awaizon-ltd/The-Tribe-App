// components/navigation/TwitterHeader.js
import React from "react";
import { View, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Logo from "../../assets/logo.png"; // swap with your actual logo path

const TwitterHeader = ({ navigation, COLORS, rightIcon = "notifications-outline", onRightPress }) => {
  const insets = useSafeAreaInsets();

  const openDrawer = () => {
    navigation.getParent("ProfileDrawer")?.openDrawer();
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: COLORS.background, borderBottomColor: COLORS.divider },
      ]}
    >
      <TouchableOpacity
        onPress={openDrawer}
        style={styles.sideButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="person-circle-outline" size={26} color={COLORS.text} />
      </TouchableOpacity>

      <Image source={Logo} style={styles.logo} resizeMode="contain" />

      <TouchableOpacity
        onPress={onRightPress}
        style={styles.sideButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name={rightIcon} size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sideButton: { width: 32, alignItems: "center", justifyContent: "center" },
  logo: { width: 34, height: 34 },
});

export default TwitterHeader;