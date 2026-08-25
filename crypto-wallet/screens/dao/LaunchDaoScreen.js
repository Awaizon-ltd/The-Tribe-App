// screens/LaunchDAOScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChainIcon from "../../components/common/ChainIcon";
import { useTheme } from "../../contexts/ThemeContext";
import {
  useLaunchDAO,
  DAO_GENRES,
  GENRE_LABELS,
  PAYMENT_METHODS,
} from "../../hooks/useLaunchDAO";
import { TransactionModal } from "../../components/TransactionModal";
import { ChainSelector } from "../../components/ChainSelector";
import TokenSelectorModal from "../../components/common/TokenSelectorModal";
import { formatEther, isAddress, Contract, formatUnits } from "ethers";
// ✅ Updated: use Cloudinary instead of Firebase
import {
  pickImage,
  uploadImageToCloudinary,
} from "../../services/ImageUploadServices";
import DaoApiService from "../../services/api/daoAPI";
import {
  getTokenListForChain,
  getTokenByAddress,
} from "../../utils/token/TokenListUtil";
import factoryABI from "../../abi/DAOFactoryAbi.json";
import Alert from "../../utils/Alert";
import ChainSwitcher from "../../components/wallet/ChainSwitcher";

const LaunchDAOScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const {
    activeChain,
    factoryAddress,
    isDeployed,
    tokenDetails,
    fetchingToken,
    tokenError,
    fetchTokenDetails,
    clearTokenDetails,
    creationFees,
    fetchingFees,
    fetchCreationFees,
    validateDAOParams,
    getCreateDAOTxParams,
    DAO_GENRES,
    GENRE_LABELS,
    PAYMENT_METHODS,
  } = useLaunchDAO();

  const [currentStep, setCurrentStep] = useState(1);
  const [showChainSwitcher, setShowChainSwitcher] = useState(false);

  const [formData, setFormData] = useState({
    daoName: "",
    genre: null,
    imageUrl: "",
    tokenAddress: "",
    quorum: "50",
    threshold: "100",
    votingPeriodHours: "72",
    timelockPeriodHours: "24",
    paymentMethod: PAYMENT_METHODS.ETH,
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [showTxModal, setShowTxModal] = useState(false);
  const [txParams, setTxParams] = useState(null);

  // Token selector state
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  useEffect(() => {
    fetchCreationFees();
  }, [fetchCreationFees]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSelectImage = async () => {
    try {
      const image = await pickImage();
      if (image) {
        setSelectedImage(image.uri);
        setErrors((prev) => ({ ...prev, imageUrl: null }));
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to select image");
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    updateField("imageUrl", "");
  };

  // Handle token selection from modal
  const handleSelectToken = async (token) => {
    console.log("[LaunchDAOScreen] Token selected:", token);

    setSelectedToken(token);
    updateField("tokenAddress", token.address);

    if (token.address && isAddress(token.address)) {
      await fetchTokenDetails(token.address);
    }
  };

  // Auto-fetch token details when address changes (for custom input)
  useEffect(() => {
    const debounce = setTimeout(() => {
      const address = formData.tokenAddress.trim();

      if (
        selectedToken &&
        selectedToken.address.toLowerCase() === address.toLowerCase()
      ) {
        return;
      }

      if (address && isAddress(address)) {
        console.log(
          "[LaunchDAOScreen] Auto-fetching token details for custom address:",
          address,
        );
        fetchTokenDetails(address);
        setSelectedToken(null);
      } else if (address && address.length >= 10) {
        clearTokenDetails();
        setSelectedToken(null);
      } else {
        clearTokenDetails();
        setSelectedToken(null);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [formData.tokenAddress]);

  const handleFetchToken = async () => {
    const address = formData.tokenAddress.trim();
    if (!address) {
      Alert.alert("Error", "Please enter a token address");
      return;
    }

    if (!isAddress(address)) {
      Alert.alert("Error", "Invalid token address format");
      return;
    }

    console.log("[LaunchDAOScreen] Manually fetching token details");
    await fetchTokenDetails(address);
  };

  const validateStep1 = () => {
    const stepErrors = {};

    if (!formData.daoName.trim()) {
      stepErrors.daoName = "DAO name is required";
    } else if (formData.daoName.length > 100) {
      stepErrors.daoName = "Name must be less than 100 characters";
    }

    if (formData.genre === null) {
      stepErrors.genre = "Please select a genre";
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep2 = () => {
    if (!tokenDetails && !tokenError) {
      Alert.alert(
        "Token Not Verified",
        "Please wait for token details to load or verify the token address is correct.",
        [{ text: "OK" }],
      );
      return false;
    }

    if (tokenError) {
      Alert.alert("Invalid Token", `Cannot proceed: ${tokenError}`, [
        { text: "OK" },
      ]);
      return false;
    }

    const validation = validateDAOParams(formData);
    setErrors(validation.errors);
    return validation.isValid;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      navigation.goBack();
    }
  };

  const handleLaunchDAO = async () => {
    if (!validateStep2()) {
      return;
    }

    try {
      let finalImageUrl = formData.imageUrl;

      // ✅ Updated: upload to Cloudinary instead of Firebase
      if (selectedImage && !formData.imageUrl) {
        setUploadingImage(true);

        try {
          const uploadResult = await uploadImageToCloudinary(
            selectedImage,
            "dao-images",
            {
              publicId: `dao_${formData.daoName.replace(/\s+/g, "_")}_${Date.now()}`,
            },
          );
          finalImageUrl = uploadResult.url;
          updateField("imageUrl", finalImageUrl);
          console.log(
            "[LaunchDAOScreen] Image uploaded to Cloudinary:",
            finalImageUrl,
          );
        } catch (uploadError) {
          setUploadingImage(false);
          Alert.alert(
            "Image Upload Failed",
            "Failed to upload image. Do you want to continue without an image?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Continue", onPress: () => proceedWithTransaction("") },
            ],
          );
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      proceedWithTransaction(finalImageUrl);
    } catch (error) {
      console.error("[LaunchDAOScreen] Error in handleLaunchDAO:", error);
      Alert.alert("Error", error.message || "Failed to launch DAO");
      setUploadingImage(false);
    }
  };

  const proceedWithTransaction = (imageUrl) => {
    const finalFormData = {
      ...formData,
      imageUrl: imageUrl || "",
    };

    const params = getCreateDAOTxParams(finalFormData);
    console.log(
      "[LaunchDAOScreen] Opening transaction modal with params:",
      params,
    );
    setTxParams(params);
    setShowTxModal(true);
  };

  const handleTxSuccess = (receipt) => {
    console.log("[LaunchDAOScreen] ✅ Transaction successful!");
    console.log("[LaunchDAOScreen] Receipt:", receipt);

    try {
      const iface = new Contract(factoryAddress, factoryABI).interface;

      let daoAddress = null;

      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog({
            topics: log.topics,
            data: log.data,
          });

          if (parsedLog && parsedLog.name === "DAOCreated") {
            daoAddress = parsedLog.args.daoAddress || parsedLog.args[0];
            console.log("[LaunchDAOScreen] ✅ DAO Address found:", daoAddress);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!daoAddress) {
        console.error(
          "[LaunchDAOScreen] ❌ Could not find DAO address in event logs",
        );
        Alert.alert(
          "DAO Created",
          "Your DAO was created successfully, but we could not find the address. Please check your transaction on the block explorer.",
          [
            {
              text: "OK",
              onPress: () => {
                setShowTxModal(false);
                navigation.goBack();
              },
            },
          ],
        );
        return;
      }

      // Notify backend immediately so the DAO appears in the community list
      // and off-chain data (creator, txHash) is persisted to MongoDB.
      // Fire-and-forget — failure is non-fatal; background sync will pick it up.
      DaoApiService.registerDAO(
        daoAddress,
        activeChain.id,
        receipt.hash,
        receipt.from || '',
      ).catch((err) =>
        console.warn("[LaunchDAOScreen] ⚠️ registerDAO failed:", err.message),
      );

      Alert.alert(
        "DAO Created! 🎉",
        `Your DAO "${formData.daoName}" has been successfully created!`,
        [
          {
            text: "View DAO",
            onPress: () => {
              setShowTxModal(false);
              navigation.navigate("DAODetails", { daoAddress });
            },
          },
          {
            text: "Done",
            style: "cancel",
            onPress: () => {
              setShowTxModal(false);
              navigation.goBack();
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        "[LaunchDAOScreen] ❌ Error parsing transaction receipt:",
        error,
      );
      Alert.alert(
        "DAO Created",
        "Your DAO was created successfully, but we encountered an error processing the result. Please check your transaction on the block explorer.",
        [
          {
            text: "OK",
            onPress: () => {
              setShowTxModal(false);
              navigation.goBack();
            },
          },
        ],
      );
    }
  };

  const handleTxError = (error) => {
    console.error("[LaunchDAOScreen] ❌ DAO creation failed:", error);
  };

  const formatTokenFee = (fee) => {
    if (!fee) return "...";
    try {
      return formatUnits(fee, 18);
    } catch (error) {
      return fee.toString();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Compact Header with Chain Switcher */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Create Community</Text>

        <TouchableOpacity
          style={styles.chainButton}
          onPress={() => setShowChainSwitcher(true)}
        >
          <ChainIcon chain={activeChain} size={18} style={styles.chainLogo} />
          <Text style={styles.chainText}>{activeChain.symbol}</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={theme.COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {!isDeployed && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={24} color={theme.COLORS.warning} />
          <Text style={styles.warningText}>
            Factory not deployed on {activeChain.name}
          </Text>
        </View>
      )}

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / 2) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>Step {currentStep} of 2</Text>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 ? (
            <Step1BasicInfo
              theme={theme}
              formData={formData}
              errors={errors}
              updateField={updateField}
              selectedImage={selectedImage}
              onSelectImage={handleSelectImage}
              onRemoveImage={handleRemoveImage}
              DAO_GENRES={DAO_GENRES}
              GENRE_LABELS={GENRE_LABELS}
            />
          ) : (
            <Step2GovernanceSettings
              theme={theme}
              formData={formData}
              errors={errors}
              updateField={updateField}
              selectedToken={selectedToken}
              tokenDetails={tokenDetails}
              fetchingToken={fetchingToken}
              tokenError={tokenError}
              onFetchToken={handleFetchToken}
              onOpenTokenSelector={() => setShowTokenSelector(true)}
              creationFees={creationFees}
              fetchingFees={fetchingFees}
              formatTokenFee={formatTokenFee}
              PAYMENT_METHODS={PAYMENT_METHODS}
            />
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={styles.footer}>
        {currentStep === 1 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>Next</Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={theme.COLORS.surface}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setCurrentStep(1)}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isDeployed || uploadingImage || fetchingToken) &&
                  styles.disabledButton,
              ]}
              onPress={handleLaunchDAO}
              disabled={!isDeployed || uploadingImage || fetchingToken}
            >
              {uploadingImage ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color={theme.COLORS.surface}
                  />
                  <Text style={styles.primaryButtonText}>Uploading...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Create Community</Text>
                  <Ionicons
                    name="rocket"
                    size={20}
                    color={theme.COLORS.surface}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chain Switcher Modal */}
      <ChainSwitcher
        visible={showChainSwitcher}
        onClose={() => setShowChainSwitcher(false)}
      />

      {/* Token Selector Modal */}
      <TokenSelectorModal
        visible={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        onSelectToken={handleSelectToken}
        chainId={activeChain?.id}
        tokenList={getTokenListForChain(activeChain?.id)}
        selectedTokenAddress={formData.tokenAddress}
      />

      {/* Transaction Modal */}
      {txParams && (
        <TransactionModal
          visible={showTxModal}
          onClose={() => setShowTxModal(false)}
          contractAddress={txParams.address}
          contractABI={txParams.abi}
          functionName={txParams.functionName}
          args={txParams.args}
          value={txParams.value}
          title="Create Your Onchain Community"
          description="You're about to create your onchain community. Please review the details carefully."
          onSuccess={handleTxSuccess}
          onError={handleTxError}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const Step1BasicInfo = ({
  theme,
  formData,
  errors,
  updateField,
  selectedImage,
  onSelectImage,
  onRemoveImage,
  DAO_GENRES,
  GENRE_LABELS,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepIcon}>📋</Text>
        <Text style={styles.stepTitle}>Basic Information</Text>
        <Text style={styles.stepDescription}>
          Let's start with the basics. Give your onchain community a name and
          select its category.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Community Name *</Text>
        <TextInput
          style={[styles.input, errors.daoName && styles.inputError]}
          placeholder="e.g., My Onchain Community"
          placeholderTextColor={theme.COLORS.textTertiary}
          value={formData.daoName}
          onChangeText={(text) => updateField("daoName", text)}
          maxLength={100}
        />
        {errors.daoName && (
          <Text style={styles.errorText}>{errors.daoName}</Text>
        )}
        <Text style={styles.helperText}>
          Choose a memorable name for your community
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Genre *</Text>
        <View style={styles.genreGrid}>
          {Object.entries(DAO_GENRES).map(([key, value]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.genreChip,
                formData.genre === value && styles.genreChipSelected,
              ]}
              onPress={() => updateField("genre", value)}
            >
              <Text
                style={[
                  styles.genreChipText,
                  formData.genre === value && styles.genreChipTextSelected,
                ]}
              >
                {GENRE_LABELS[value]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.genre && <Text style={styles.errorText}>{errors.genre}</Text>}
        <Text style={styles.helperText}>
          Select the category that best describes your community
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Community Image (Optional)</Text>

        {selectedImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.imagePreview}
            />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={onRemoveImage}
            >
              <Ionicons
                name="close-circle"
                size={24}
                color={theme.COLORS.error}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeImageButton}
              onPress={onSelectImage}
            >
              <Ionicons name="camera" size={16} color={theme.COLORS.primary} />
              <Text style={styles.changeImageText}>Change Image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={onSelectImage}>
            <Ionicons
              name="cloud-upload-outline"
              size={32}
              color={theme.COLORS.primary}
            />
            <Text style={styles.uploadButtonText}>Upload Community Image</Text>
            <Text style={styles.uploadButtonSubtext}>
              Tap to select from gallery
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.helperText}>
          Add a logo or banner for your community. Recommended: 1:1 aspect ratio
          (square)
        </Text>
      </View>
    </View>
  );
};

const Step2GovernanceSettings = ({
  theme,
  formData,
  errors,
  updateField,
  selectedToken,
  tokenDetails,
  fetchingToken,
  tokenError,
  onFetchToken,
  onOpenTokenSelector,
  creationFees,
  fetchingFees,
  formatTokenFee,
  PAYMENT_METHODS,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepIcon}>⚙️</Text>
        <Text style={styles.stepTitle}>Governance Settings</Text>
        <Text style={styles.stepDescription}>
          Configure how your community will govern and make decisions onchain.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Governance Token *</Text>

        <TouchableOpacity
          style={styles.tokenSelectorButton}
          onPress={onOpenTokenSelector}
        >
          <View style={styles.tokenSelectorLeft}>
            {selectedToken && selectedToken.logoURI ? (
              <Image
                source={{ uri: selectedToken.logoURI }}
                style={styles.tokenSelectorLogo}
              />
            ) : (
              <View style={styles.tokenSelectorLogoPlaceholder}>
                <Ionicons
                  name="diamond-outline"
                  size={20}
                  color={theme.COLORS.primary}
                />
              </View>
            )}

            <View style={styles.tokenSelectorInfo}>
              {selectedToken && !selectedToken.isCustom ? (
                <>
                  <Text style={styles.tokenSelectorSymbol}>
                    {selectedToken.symbol}
                  </Text>
                  <Text style={styles.tokenSelectorName} numberOfLines={1}>
                    {selectedToken.name}
                  </Text>
                </>
              ) : formData.tokenAddress ? (
                <>
                  <Text style={styles.tokenSelectorSymbol}>Custom Token</Text>
                  <Text style={styles.tokenSelectorName} numberOfLines={1}>
                    {formData.tokenAddress.substring(0, 10)}...
                  </Text>
                </>
              ) : (
                <Text style={styles.tokenSelectorPlaceholder}>
                  Select token or enter address
                </Text>
              )}
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.COLORS.textTertiary}
          />
        </TouchableOpacity>

        {errors.tokenAddress && (
          <Text style={styles.errorText}>{errors.tokenAddress}</Text>
        )}

        {fetchingToken && (
          <View style={styles.tokenDetailsLoading}>
            <ActivityIndicator size="small" color={theme.COLORS.primary} />
            <Text style={styles.tokenDetailsLoadingText}>
              Verifying token contract...
            </Text>
          </View>
        )}

        {tokenError && !fetchingToken && (
          <View style={styles.tokenDetailsError}>
            <Ionicons
              name="alert-circle"
              size={20}
              color={theme.COLORS.error}
            />
            <Text style={styles.tokenErrorText}>{tokenError}</Text>
          </View>
        )}

        {tokenDetails && !fetchingToken && !tokenError && (
          <View style={styles.tokenDetailsCard}>
            <View style={styles.tokenDetailsHeader}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.COLORS.success}
              />
              <Text style={styles.tokenDetailsTitle}>Token Verified ✓</Text>
            </View>

            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Name:</Text>
              <Text style={styles.tokenDetailValue}>{tokenDetails.name}</Text>
            </View>

            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Symbol:</Text>
              <Text style={styles.tokenDetailValue}>{tokenDetails.symbol}</Text>
            </View>

            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Decimals:</Text>
              <Text style={styles.tokenDetailValue}>
                {tokenDetails.decimals}
              </Text>
            </View>

            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Total Supply:</Text>
              <Text style={styles.tokenDetailValue}>
                {(
                  Number(tokenDetails.totalSupply) /
                  Math.pow(10, tokenDetails.decimals)
                ).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.helperText}>
          Select from the list or enter a custom ERC-20 token address for voting
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Quorum (%) *</Text>
        <TextInput
          style={[styles.input, errors.quorum && styles.inputError]}
          placeholder="50"
          placeholderTextColor={theme.COLORS.textTertiary}
          value={formData.quorum}
          onChangeText={(text) => updateField("quorum", text)}
          keyboardType="numeric"
        />
        {errors.quorum && <Text style={styles.errorText}>{errors.quorum}</Text>}
        <Text style={styles.helperText}>
          Minimum % of total token supply required to pass proposals (1-100)
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Proposal Threshold *</Text>
        <TextInput
          style={[styles.input, errors.threshold && styles.inputError]}
          placeholder="100"
          placeholderTextColor={theme.COLORS.textTertiary}
          value={formData.threshold}
          onChangeText={(text) => updateField("threshold", text)}
          keyboardType="numeric"
        />
        {errors.threshold && (
          <Text style={styles.errorText}>{errors.threshold}</Text>
        )}
        <Text style={styles.helperText}>
          Minimum tokens required to create a proposal
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Voting Period (Hours) *</Text>
        <TextInput
          style={[styles.input, errors.votingPeriodHours && styles.inputError]}
          placeholder="72"
          placeholderTextColor={theme.COLORS.textTertiary}
          value={formData.votingPeriodHours}
          onChangeText={(text) => updateField("votingPeriodHours", text)}
          keyboardType="numeric"
        />
        {errors.votingPeriodHours && (
          <Text style={styles.errorText}>{errors.votingPeriodHours}</Text>
        )}
        <Text style={styles.helperText}>
          How long members have to vote on proposals
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Timelock Period (Hours) *</Text>
        <TextInput
          style={[
            styles.input,
            errors.timelockPeriodHours && styles.inputError,
          ]}
          placeholder="24"
          placeholderTextColor={theme.COLORS.textTertiary}
          value={formData.timelockPeriodHours}
          onChangeText={(text) => updateField("timelockPeriodHours", text)}
          keyboardType="numeric"
        />
        {errors.timelockPeriodHours && (
          <Text style={styles.errorText}>{errors.timelockPeriodHours}</Text>
        )}
        <Text style={styles.helperText}>
          Delay before executing passed proposals (min:{" "}
          {creationFees.minTimelock || 1} hours)
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Payment Method *</Text>
        <View style={styles.paymentOptions}>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              formData.paymentMethod === PAYMENT_METHODS.ETH &&
                styles.paymentOptionSelected,
            ]}
            onPress={() => updateField("paymentMethod", PAYMENT_METHODS.ETH)}
          >
            <Ionicons
              name={
                formData.paymentMethod === PAYMENT_METHODS.ETH
                  ? "radio-button-on"
                  : "radio-button-off"
              }
              size={20}
              color={
                formData.paymentMethod === PAYMENT_METHODS.ETH
                  ? theme.COLORS.primary
                  : theme.COLORS.textSecondary
              }
            />
            <View style={styles.paymentOptionContent}>
              <Text style={styles.paymentOptionTitle}>Pay with ETH</Text>
              <Text style={styles.paymentOptionFee}>
                Fee:{" "}
                {creationFees.ethFee ? formatEther(creationFees.ethFee) : "..."}{" "}
                ETH
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={true}
            style={[
              styles.paymentOption,
              styles.paymentOptionDisabled,
              formData.paymentMethod === PAYMENT_METHODS.TOKEN &&
                styles.paymentOptionSelected,
            ]}
            activeOpacity={1}
          >
            <Ionicons
              name="radio-button-off"
              size={20}
              color={theme.COLORS.textSecondary}
            />
            <View style={styles.paymentOptionContent}>
              <Text style={styles.paymentOptionTitle}>Pay with SYN</Text>
              <Text style={styles.paymentOptionFee}>
                Fee: {formatTokenFee(creationFees.tokenFee)} SYN
              </Text>
              <Text style={styles.disabledBadge}>Coming Soon 🚀</Text>
            </View>
          </TouchableOpacity>
        </View>
        {errors.paymentMethod && (
          <Text style={styles.errorText}>{errors.paymentMethod}</Text>
        )}
      </View>
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
      paddingBottom: 20,
    },
    backButton: {
      padding: theme.SPACING.xs,
    },
    headerTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.text,
      flex: 1,
      textAlign: "center",
    },
    chainButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.COLORS.surface,
      paddingHorizontal: theme.SPACING.sm,
      paddingVertical: theme.SPACING.xs,
      borderRadius: theme.BORDER_RADIUS.md,
      gap: theme.SPACING.xs,
    },
    chainLogo: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    chainText: {
      fontSize: theme.FONTS.sizes.xs,
      fontWeight: "600",
      color: theme.COLORS.text,
    },
    chainSelectorContainer: {
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
    },
    warningContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.COLORS.warning}20`,
      borderWidth: 1,
      borderColor: theme.COLORS.warning,
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.md,
      marginHorizontal: theme.SPACING.lg,
      marginTop: theme.SPACING.md,
      gap: theme.SPACING.sm,
    },
    warningText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.warning,
      fontWeight: "500",
    },
    progressContainer: {
      padding: theme.SPACING.lg,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.COLORS.divider,
      borderRadius: 2,
      overflow: "hidden",
      marginBottom: theme.SPACING.sm,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.COLORS.primary,
    },
    progressText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.SPACING.lg,
    },
    stepContainer: {
      paddingBottom: theme.SPACING.xl,
    },
    stepHeader: {
      alignItems: "center",
      marginBottom: theme.SPACING.xl,
    },
    stepIcon: {
      fontSize: 48,
      marginBottom: theme.SPACING.sm,
    },
    stepTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "bold",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
    },
    stepDescription: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: theme.SPACING.md,
    },
    inputGroup: {
      marginBottom: theme.SPACING.lg,
    },
    label: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    input: {
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.md,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
    },
    inputError: {
      borderColor: theme.COLORS.error,
    },
    helperText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textTertiary,
      marginTop: theme.SPACING.xs,
      lineHeight: 18,
    },
    errorText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.error,
      marginTop: theme.SPACING.xs,
    },
    genreGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.SPACING.sm,
    },
    genreChip: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      borderRadius: theme.BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    genreChipSelected: {
      borderColor: theme.COLORS.primary,
      backgroundColor: `${theme.COLORS.primary}20`,
    },
    genreChipText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    genreChipTextSelected: {
      color: theme.COLORS.primary,
      fontWeight: "600",
    },
    uploadButton: {
      backgroundColor: theme.COLORS.surface,
      borderWidth: 2,
      borderColor: theme.COLORS.border,
      borderStyle: "dashed",
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    uploadButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.primary,
      marginTop: theme.SPACING.sm,
    },
    uploadButtonSubtext: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textTertiary,
      marginTop: theme.SPACING.xs,
    },
    imagePreviewContainer: {
      position: "relative",
      alignItems: "center",
    },
    imagePreview: {
      width: "100%",
      height: 200,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.surface,
    },
    removeImageButton: {
      position: "absolute",
      top: theme.SPACING.sm,
      right: theme.SPACING.sm,
      backgroundColor: theme.COLORS.surface,
      borderRadius: 12,
      padding: 2,
    },
    changeImageButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.SPACING.md,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.primary}20`,
      borderRadius: theme.BORDER_RADIUS.md,
      gap: theme.SPACING.xs,
    },
    changeImageText: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "600",
      color: theme.COLORS.primary,
    },
    tokenSelectorButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.md,
      minHeight: 60,
    },
    tokenSelectorLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    tokenSelectorLogo: {
      width: 36,
      height: 36,
      borderRadius: theme.BORDER_RADIUS.round,
      marginRight: theme.SPACING.sm,
    },
    tokenSelectorLogoPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: theme.BORDER_RADIUS.round,
      backgroundColor: `${theme.COLORS.primary}20`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.SPACING.sm,
    },
    tokenSelectorInfo: {
      flex: 1,
    },
    tokenSelectorSymbol: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.text,
    },
    tokenSelectorName: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: 2,
    },
    tokenSelectorPlaceholder: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textTertiary,
    },
    tokenDetailsLoading: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.SPACING.md,
      marginTop: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.primary}10`,
      borderRadius: theme.BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: theme.COLORS.primary,
    },
    tokenDetailsLoadingText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      marginLeft: theme.SPACING.sm,
    },
    tokenDetailsError: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.SPACING.md,
      marginTop: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.error}10`,
      borderRadius: theme.BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: theme.COLORS.error,
      gap: theme.SPACING.sm,
    },
    tokenErrorText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.error,
    },
    tokenDetailsCard: {
      padding: theme.SPACING.md,
      marginTop: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.success}10`,
      borderRadius: theme.BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: theme.COLORS.success,
    },
    tokenDetailsHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.SPACING.sm,
      gap: theme.SPACING.xs,
    },
    tokenDetailsTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.success,
    },
    tokenDetailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.SPACING.xs,
    },
    tokenDetailLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    tokenDetailValue: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: "600",
    },
    paymentOptions: {
      gap: theme.SPACING.md,
    },
    paymentOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    paymentOptionSelected: {
      borderColor: theme.COLORS.primary,
      backgroundColor: `${theme.COLORS.primary}10`,
    },
    paymentOptionContent: {
      marginLeft: theme.SPACING.md,
      flex: 1,
    },
    paymentOptionTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
    },
    paymentOptionFee: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    paymentOptionDisabled: {
      opacity: 0.45,
    },
    disabledBadge: {
      marginTop: 4,
      fontSize: 12,
      color: theme.COLORS.warning,
    },
    footer: {
      padding: theme.SPACING.lg,
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.divider,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.COLORS.primary,
      borderRadius: theme.BORDER_RADIUS.md,
      paddingVertical: theme.SPACING.md,
      gap: theme.SPACING.sm,
      ...theme.SHADOWS.small,
    },
    primaryButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "bold",
      color: theme.COLORS.surface,
    },
    buttonRow: {
      flexDirection: "row",
      gap: theme.SPACING.md,
    },
    secondaryButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.COLORS.background,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      borderRadius: theme.BORDER_RADIUS.md,
      paddingVertical: theme.SPACING.md,
    },
    secondaryButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "bold",
      color: theme.COLORS.text,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });

export default LaunchDAOScreen;
