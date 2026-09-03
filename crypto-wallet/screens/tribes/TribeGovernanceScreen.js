import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TribeGovernanceTab from '../../components/tribe/TribeGovernanceTab';

const TribeGovernanceScreen = ({ route, navigation }) => {
  const { daoAddress, chainId } = route.params;
  const insets = useSafeAreaInsets();
  return (
    // Only this standalone-route wrapper needs the inset — TribeGovernanceTab
    // is also embedded as a tab inside TribeDetailsScreen, below that
    // screen's own banner, where it must NOT double up on top padding.
    <View style={[s.container, { paddingTop: insets.top }]}>
      <TribeGovernanceTab
        daoAddress={daoAddress}
        chainId={chainId}
        navigation={navigation}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
});

export default TribeGovernanceScreen;
