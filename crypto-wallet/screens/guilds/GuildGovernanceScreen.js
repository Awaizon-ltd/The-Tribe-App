import React from 'react';
import { View, StyleSheet } from 'react-native';
import GuildGovernanceTab from '../../components/guild/GuildGovernanceTab';

const GuildGovernanceScreen = ({ route, navigation }) => {
  const { daoAddress, chainId } = route.params;
  return (
    <View style={s.container}>
      <GuildGovernanceTab
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

export default GuildGovernanceScreen;
