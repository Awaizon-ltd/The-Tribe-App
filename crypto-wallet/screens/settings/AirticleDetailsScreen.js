import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed
import ArticleRenderer from '../../components/support/ArticleRenderer';

const ArticleDetailScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { article } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Article</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Article Header */}
        <View style={styles.articleHeader}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>{article.icon}</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{article.category}</Text>
          </View>
        </View>

        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.description}>{article.description}</Text>

        {/* Article Content - Custom Renderer */}
        <View style={styles.articleContent}>
          <ArticleRenderer content={article.content} />
        </View>

        {/* Helpful Section */}
        <View style={styles.helpfulSection}>
          <Text style={styles.helpfulTitle}>Was this article helpful?</Text>
          <View style={styles.helpfulButtons}>
            <TouchableOpacity style={styles.helpfulButton}>
              <Ionicons name="thumbs-up-outline" size={20} color={theme.COLORS.success} />
              <Text style={styles.helpfulButtonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpfulButton}>
              <Ionicons name="thumbs-down-outline" size={20} color={theme.COLORS.error} />
              <Text style={styles.helpfulButtonText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Still Need Help */}
        <View style={styles.needHelpSection}>
          <Ionicons name="help-circle-outline" size={24} color={theme.COLORS.primary} />
          <Text style={styles.needHelpText}>Still need help?</Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate('Support')}
          >
            <Text style={styles.contactButtonText}>Contact Support</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    backButton: {
      padding: theme.SPACING.xs,
    },
    headerTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    content: {
      padding: theme.SPACING.lg,
      paddingBottom: 120,
    },
    articleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.SPACING.lg,
    },
    iconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.COLORS.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: 32,
    },
    categoryBadge: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.xs,
      backgroundColor: theme.COLORS.primary + '20',
      borderRadius: 16,
    },
    categoryText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      fontWeight: '600',
    },
    title: {
      fontSize: theme.FONTS.sizes.xxl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    description: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      marginBottom: theme.SPACING.xl,
      lineHeight: 22,
    },
    articleContent: {
      marginBottom: theme.SPACING.xl,
    },
    helpfulSection: {
      backgroundColor: theme.COLORS.surface,
      padding: theme.SPACING.lg,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: theme.SPACING.lg,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    helpfulTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.md,
    },
    helpfulButtons: {
      flexDirection: 'row',
      gap: theme.SPACING.md,
    },
    helpfulButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.xs,
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.sm,
      backgroundColor: theme.COLORS.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    helpfulButtonText: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    needHelpSection: {
      alignItems: 'center',
      padding: theme.SPACING.lg,
      backgroundColor: theme.COLORS.primary + '10',
      borderRadius: 12,
    },
    needHelpText: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    contactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.xs,
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.sm,
    },
    contactButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.primary,
    },
  });

export default ArticleDetailScreen;