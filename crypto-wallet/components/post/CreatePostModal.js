import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../../services/ImageUploadServices'; // Adjust path as needed
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed
import Alert from '../../utils/Alert';

const CreatePostModal = ({ visible, onClose, onCreate, guildId }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permission to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permission to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadImage = async () => {
    if (!imageUri) return null;

    try {
      // Uploads via backend-signed request → Cloudinary (see CloudinaryService).
      // folder mirrors the old Firebase path convention: posts/{guildId}/...
      const { url } = await uploadImageToCloudinary(imageUri, `posts/${guildId}`);
      return url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleCreate = async () => {
    if (!description.trim() && !imageUri) {
      Alert.alert('Error', 'Please add a description or image');
      return;
    }

    setUploading(true);
    try {
      let imageUrl = null;
      
      if (imageUri) {
        imageUrl = await uploadImage();
      }

      await onCreate(description, imageUrl);
      
      // Reset form
      setDescription('');
      setImageUri(null);
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setDescription('');
      setImageUri(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={uploading}>
            <Ionicons name="close" size={28} color={theme.COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={uploading || (!description.trim() && !imageUri)}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.COLORS.primary} />
            ) : (
              <Text
                style={[
                  styles.postButton,
                  (!description.trim() && !imageUri) && styles.postButtonDisabled,
                ]}
              >
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content with keyboard dismissal */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              style={styles.input}
              placeholder="What's happening in the guild?"
              placeholderTextColor={theme.COLORS.textSecondary}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              editable={!uploading}
            />

            <Text style={styles.characterCount}>
              {description.length}/500
            </Text>

            {/* Image Preview */}
            {imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                  disabled={uploading}
                >
                  <Ionicons name="close-circle" size={28} color={theme.COLORS.text} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={showImageOptions}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={24} color={theme.COLORS.primary} />
            <Text style={styles.actionText}>Add Photo</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      paddingTop:50,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
      backgroundColor: theme.COLORS.surface,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    postButton: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.COLORS.primary,
    },
    postButtonDisabled: {
      color: theme.COLORS.textSecondary,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: theme.SPACING.md,
      paddingTop: theme.SPACING.md,
    },
    input: {
      fontSize: 16,
      color: theme.COLORS.text,
      minHeight: 150,
      textAlignVertical: 'top',
    },
    characterCount: {
      fontSize: 12,
      color: theme.COLORS.textSecondary,
      textAlign: 'right',
      marginTop: theme.SPACING.xs,
    },
    imagePreviewContainer: {
      marginTop: theme.SPACING.md,
      position: 'relative',
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.surface,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 14,
    },
    actions: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.md,
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.divider,
      backgroundColor: theme.COLORS.surface,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
    },
    actionText: {
      fontSize: 16,
      color: theme.COLORS.primary,
      fontWeight: '500',
    },
  });

export default CreatePostModal;