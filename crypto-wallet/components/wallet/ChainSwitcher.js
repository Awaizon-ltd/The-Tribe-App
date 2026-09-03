import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { useChain } from '../../contexts/ChainContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAvailableChains } from '../../hooks/useAvailableChains';
import Button from '../common/Button';
import ChainIcon from '../common/ChainIcon';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/Theme';
import Alert from '../../utils/Alert';

const ChainSwitcher = ({ visible, onClose }) => {
  const { COLORS } = useTheme();
  const { switchChain } = useChain();
  const { availableChains: chains, activeChain } = useAvailableChains();

  const handleSelectChain = async (chain) => {
    try {
      await switchChain(chain);
      onClose();
    } catch (error) {
      console.error('Error switching chain:', error);
      Alert.alert('Failed to switch network. Please try again.');
    }
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      maxHeight: '80%',
      paddingTop: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: FONTS.sizes.xl,
      fontWeight: 'bold',
      color: COLORS.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeText: {
      fontSize: 20,
      color: COLORS.text,
    },
    currentNetwork: {
      backgroundColor: COLORS.surface,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.md,
    },
    currentLabel: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textSecondary,
      marginBottom: SPACING.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    currentChainInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    currentChainIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    currentChainName: {
      fontSize: FONTS.sizes.md,
      fontWeight: '600',
      color: COLORS.primary,
    },
    list: {
      paddingBottom: SPACING.md,
    },
    chainCard: {
      marginBottom: SPACING.xs,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      backgroundColor: 'transparent',
      borderRadius: BORDER_RADIUS.md,
    },
    chainCardSelected: {
      backgroundColor: `${COLORS.primary}18`,
    },
    chainContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chainLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    chainIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    chainName: {
      fontSize: FONTS.sizes.lg,
      fontWeight: 'bold',
      color: COLORS.text,
      marginBottom: SPACING.xs,
    },
    chainNameSelected: {
      color: COLORS.primary,
    },
    chainSymbol: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
    },
    selectedBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedText: {
      fontSize: 16,
      color: COLORS.onPrimary, // selectedBadge's bg is COLORS.primary
      fontWeight: 'bold',
    },
    testnetBadge: {
      backgroundColor: COLORS.warning,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: SPACING.sm,
      alignSelf: 'flex-start',
      marginTop: SPACING.sm,
    },
    testnetText: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.background,
      fontWeight: 'bold',
    },
    cancelButton: {
      marginTop: SPACING.md,
    },
  });

  const renderChain = ({ item }) => {
    const isSelected = item.id === activeChain?.id;

    return (
      <Pressable
        onPress={() => handleSelectChain(item)}
        style={({ pressed }) => [
          styles.chainCard,
          isSelected && styles.chainCardSelected,
          pressed && { opacity: 0.6 },
        ]}
      >
        <View style={styles.chainContent}>
          <View style={styles.chainLeft}>
            <ChainIcon chain={item} size={36} style={styles.chainIcon} />

            <View>
              <Text style={[
                styles.chainName,
                isSelected && styles.chainNameSelected
              ]}>
                {item.name}
              </Text>
              <Text style={styles.chainSymbol}>{item.symbol}</Text>
            </View>
          </View>

          {isSelected && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedText}>✓</Text>
            </View>
          )}
        </View>

        {item.testnet && (
          <View style={styles.testnetBadge}>
            <Text style={styles.testnetText}>Testnet</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Network</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Current Network Info */}
          <View style={styles.currentNetwork}>
            <Text style={styles.currentLabel}>Current Network:</Text>
            <View style={styles.currentChainInfo}>
              <ChainIcon chain={activeChain} size={24} style={styles.currentChainIcon} />
              <Text style={styles.currentChainName}>{activeChain.name}</Text>
            </View>
          </View>

          {/* Chains List */}
          <FlatList
            data={chains}
            renderItem={renderChain}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />

          {/* Close Button */}
          <Button
            title="Cancel"
            onPress={onClose}
            variant="outline"
            fullWidth
            style={styles.cancelButton}
          />
        </View>
      </View>
    </Modal>
  );
};

export default ChainSwitcher;