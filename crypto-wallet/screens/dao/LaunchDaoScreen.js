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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChainIcon from "../../components/common/ChainIcon";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import {
  useLaunchDAO,
  DAO_GENRES,
  GENRE_LABELS,
  PAYMENT_METHODS,
} from "../../hooks/useLaunchDAO";
import { TransactionModal } from "../../components/TransactionModal";
import TokenSelectorModal from "../../components/common/TokenSelectorModal";
import { isAddress, Contract, formatUnits } from "ethers";
// ✅ Updated: use Cloudinary instead of Firebase
import {
  pickImage,
  uploadImageToCloudinary,
} from "../../services/ImageUploadServices";
import DaoApiService from "../../services/api/daoAPI";
import { getTokenListForChain } from "../../utils/token/TokenListUtil";
import factoryABI from "../../abi/DAOFactoryAbi.json";
import Alert from "../../utils/Alert";
import ChainSwitcher from "../../components/wallet/ChainSwitcher";

// Minimal ERC20 surface needed to pay the creation fee in a token instead of
// the chain's native currency — read the current allowance, and approve the
// factory to pull the fee if it isn't enough yet.
const FEE_TOKEN_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const GENRE_ICONS = {
  0: "image-outline",
  1: "game-controller-outline",
  2: "people-outline",
  3: "trending-up-outline",
  4: "sparkles-outline",
  5: "flame-outline",
  6: "rocket-outline",
  7: "business-outline",
  8: "hardware-chip-outline",
  9: "share-social-outline",
  10: "planet-outline",
  11: "ellipsis-horizontal-outline",
};

const LaunchDAOScreen = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const { provider, address } = useWallet();

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
  // 'create' pays for the DAO itself; 'approve' is the ERC20 pre-step that
  // only happens when paying the fee in a token and the allowance is short.
  const [pendingAction, setPendingAction] = useState("create");
  const [pendingFormData, setPendingFormData] = useState(null);
  const [checkingAllowance, setCheckingAllowance] = useState(false);

  // Token selector state
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  useEffect(() => {
    fetchCreationFees();
  }, [fetchCreationFees]);

  // If the token option was selected while a different factory had one
  // configured, and the active chain's factory doesn't, fall back to ETH
  // rather than leaving an unusable option silently selected.
  useEffect(() => {
    if (
      formData.paymentMethod === PAYMENT_METHODS.TOKEN &&
      !fetchingFees &&
      !creationFees.feeTokenSymbol
    ) {
      updateField("paymentMethod", PAYMENT_METHODS.ETH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creationFees.feeTokenSymbol, fetchingFees]);

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
        fetchTokenDetails(address);
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

      await proceedWithTransaction(finalImageUrl);
    } catch (error) {
      console.error("[LaunchDAOScreen] Error in handleLaunchDAO:", error);
      Alert.alert("Error", error.message || "Failed to launch DAO");
      setUploadingImage(false);
    }
  };

  const proceedWithTransaction = async (imageUrl) => {
    const finalFormData = {
      ...formData,
      imageUrl: imageUrl || "",
    };

    if (finalFormData.paymentMethod === PAYMENT_METHODS.TOKEN) {
      if (!creationFees.feeTokenAddress) {
        Alert.alert(
          "Token Payment Unavailable",
          "This chain's factory hasn't been configured with a fee token yet. Pay with the native currency instead.",
        );
        return;
      }

      // createDAO pulls the fee via transferFrom — without enough allowance
      // it just reverts. Check first, and if short, run approve() as its
      // own transaction before opening the real creation transaction.
      setCheckingAllowance(true);
      try {
        const erc20 = new Contract(creationFees.feeTokenAddress, FEE_TOKEN_ABI, provider);
        const required = BigInt(creationFees.tokenFee || "0");
        const current = BigInt(await erc20.allowance(address, factoryAddress));

        if (current < required) {
          setPendingFormData(finalFormData);
          setPendingAction("approve");
          setTxParams({
            address: creationFees.feeTokenAddress,
            abi: FEE_TOKEN_ABI,
            functionName: "approve",
            args: [factoryAddress, required.toString()],
            value: "0",
          });
          setShowTxModal(true);
          return;
        }
      } catch (error) {
        console.error("[LaunchDAOScreen] Allowance check failed:", error);
        Alert.alert("Error", `Could not check ${creationFees.feeTokenSymbol} allowance: ${error.message}`);
        return;
      } finally {
        setCheckingAllowance(false);
      }
    }

    setPendingAction("create");
    const params = getCreateDAOTxParams(finalFormData);
    setTxParams(params);
    setShowTxModal(true);
  };

  const handleTxSuccess = (receipt) => {
    // Approval confirmed — chain straight into the real creation tx rather
    // than making the user tap "Create" again.
    if (pendingAction === "approve") {
      setShowTxModal(false);
      const params = getCreateDAOTxParams(pendingFormData);
      setPendingAction("create");
      setTimeout(() => {
        setTxParams(params);
        setShowTxModal(true);
      }, 300);
      return;
    }

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
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!daoAddress) {
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
    console.error("[LaunchDAOScreen] ❌ Transaction failed:", error);
    if (pendingAction === "approve") {
      // Leave the form as-is — user can just tap Create again to retry.
      setPendingFormData(null);
    }
  };

  const formatTokenFee = (fee) => {
    if (!fee) return "...";
    try {
      return formatUnits(fee, creationFees.feeTokenDecimals || 18);
    } catch (error) {
      return fee.toString();
    }
  };

  // The native-currency fee is always 18 decimals regardless of what the
  // fee ERC20's decimals() happens to report — keep the two formatters
  // separate rather than reusing formatTokenFee for both.
  const formatEthFee = (fee) => {
    if (!fee) return "...";
    try {
      const formatted = formatUnits(fee, 18);
      return formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    } catch (error) {
      return fee.toString();
    }
  };

  const launchDisabled =
    !isDeployed || uploadingImage || fetchingToken || checkingAllowance;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
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
          <Ionicons name="warning" size={20} color={theme.COLORS.warning} />
          <Text style={styles.warningText}>
            Factory not deployed on {activeChain.name}
          </Text>
        </View>
      )}

      {/* ── Stepper ── */}
      <StepIndicator theme={theme} currentStep={currentStep} />

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
              formatEthFee={formatEthFee}
              PAYMENT_METHODS={PAYMENT_METHODS}
              chainSymbol={activeChain.symbol}
            />
          )}
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.SPACING.md }]}>
        {currentStep === 1 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.COLORS.onPrimary} />
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
              style={[styles.primaryButton, launchDisabled && styles.disabledButton]}
              onPress={handleLaunchDAO}
              disabled={launchDisabled}
            >
              {uploadingImage || checkingAllowance ? (
                <>
                  <ActivityIndicator size="small" color={theme.COLORS.onPrimary} />
                  <Text style={styles.primaryButtonText}>
                    {uploadingImage ? "Uploading..." : "Checking allowance..."}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Create Community</Text>
                  <Ionicons name="rocket" size={20} color={theme.COLORS.onPrimary} />
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

      {/* Transaction Modal — reused for both the approve() pre-step and the
          real createDAO() call; title (and the fee-token hero amount, when
          paying in a token) reflect which one is currently pending. */}
      {txParams && (
        <TransactionModal
          visible={showTxModal}
          onClose={() => setShowTxModal(false)}
          contractAddress={txParams.address}
          contractABI={txParams.abi}
          functionName={txParams.functionName}
          args={txParams.args}
          value={txParams.value}
          title={
            pendingAction === "approve"
              ? `Approve ${formatTokenFee(creationFees.tokenFee)} ${creationFees.feeTokenSymbol || "Token"} Fee`
              : "Create Your Onchain Community"
          }
          tokenAmount={
            pendingAction === "approve" ||
            (pendingAction === "create" && formData.paymentMethod === PAYMENT_METHODS.TOKEN)
              ? formatTokenFee(creationFees.tokenFee)
              : undefined
          }
          tokenSymbol={
            pendingAction === "approve" ||
            (pendingAction === "create" && formData.paymentMethod === PAYMENT_METHODS.TOKEN)
              ? creationFees.feeTokenSymbol
              : undefined
          }
          chainSymbol={activeChain.symbol}
          onSuccess={handleTxSuccess}
          onError={handleTxError}
        />
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEP_META = [
  { icon: "document-text-outline", label: "Basics" },
  { icon: "settings-outline", label: "Settings" },
];

const StepIndicator = ({ theme, currentStep }) => {
  const s = stepIndicatorStyles(theme);
  return (
    <View style={s.row}>
      {STEP_META.map((step, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;
        return (
          <React.Fragment key={step.label}>
            <View style={s.item}>
              <View
                style={[
                  s.dot,
                  done && s.dotDone,
                  active && s.dotActive,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={16} color={theme.COLORS.onPrimary} />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={15}
                    color={active ? theme.COLORS.onPrimary : theme.COLORS.textTertiary}
                  />
                )}
              </View>
              <Text style={[s.label, (active || done) && s.labelActive]}>{step.label}</Text>
            </View>
            {i < STEP_META.length - 1 && (
              <View style={[s.connector, currentStep > stepNum && s.connectorDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const stepIndicatorStyles = (theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: theme.SPACING.xl,
      paddingTop: theme.SPACING.lg,
      paddingBottom: theme.SPACING.md,
    },
    item: { alignItems: "center", gap: 6, width: 72 },
    dot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1.5,
      borderColor: theme.COLORS.border,
    },
    dotActive: { backgroundColor: theme.COLORS.primary, borderColor: theme.COLORS.primary },
    dotDone: { backgroundColor: theme.COLORS.primary, borderColor: theme.COLORS.primary },
    label: { fontSize: theme.FONTS.sizes.xs, color: theme.COLORS.textTertiary, fontWeight: "600" },
    labelActive: { color: theme.COLORS.text },
    connector: {
      flex: 1,
      height: 1.5,
      backgroundColor: theme.COLORS.border,
      marginTop: 16,
      marginHorizontal: -8,
    },
    connectorDone: { backgroundColor: theme.COLORS.primary },
  });

// ─── Shared section header ──────────────────────────────────────────────────

const SectionHeader = ({ theme, icon, title, description }) => {
  const s = sectionHeaderStyles(theme);
  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <Ionicons name={icon} size={26} color={theme.COLORS.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      {!!description && <Text style={s.description}>{description}</Text>}
    </View>
  );
};

const sectionHeaderStyles = (theme) =>
  StyleSheet.create({
    wrap: { alignItems: "center", marginBottom: theme.SPACING.xl },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${theme.COLORS.primary}18`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.SPACING.sm,
    },
    title: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "800",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
      letterSpacing: -0.3,
    },
    description: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: theme.SPACING.md,
    },
  });

// ─── Card wrapper (groups related fields) ───────────────────────────────────

const FormCard = ({ theme, title, children }) => {
  const s = formCardStyles(theme);
  return (
    <View style={s.card}>
      {!!title && <Text style={s.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
};

const formCardStyles = (theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
    },
    cardTitle: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "700",
      color: theme.COLORS.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: theme.SPACING.md,
    },
  });

// ─── Step 1 ──────────────────────────────────────────────────────────────────

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
      <SectionHeader
        theme={theme}
        icon="clipboard-outline"
        title="Basic Information"
        description="Give your onchain community a name and pick the category that fits it best."
      />

      <FormCard theme={theme}>
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
          {errors.daoName ? (
            <Text style={styles.errorText}>{errors.daoName}</Text>
          ) : (
            <Text style={styles.helperText}>Choose a memorable name for your community</Text>
          )}
        </View>

        <View style={[styles.inputGroup, { marginBottom: 0 }]}>
          <Text style={styles.label}>Genre *</Text>
          <View style={styles.genreGrid}>
            {Object.entries(DAO_GENRES).map(([, value]) => {
              const selected = formData.genre === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.genreChip, selected && styles.genreChipSelected]}
                  onPress={() => updateField("genre", value)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={GENRE_ICONS[value] || "ellipsis-horizontal-outline"}
                    size={14}
                    color={selected ? theme.COLORS.onPrimary : theme.COLORS.textSecondary}
                  />
                  <Text style={[styles.genreChipText, selected && styles.genreChipTextSelected]}>
                    {GENRE_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.genre && <Text style={styles.errorText}>{errors.genre}</Text>}
        </View>
      </FormCard>

      <FormCard theme={theme} title="Community Image · Optional">
        {selectedImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageButton} onPress={onRemoveImage}>
              <Ionicons name="close-circle" size={24} color={theme.COLORS.error} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.changeImageButton} onPress={onSelectImage}>
              <Ionicons name="camera" size={16} color={theme.COLORS.primary} />
              <Text style={styles.changeImageText}>Change Image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={onSelectImage} activeOpacity={0.8}>
            <Ionicons name="cloud-upload-outline" size={30} color={theme.COLORS.primary} />
            <Text style={styles.uploadButtonText}>Upload Community Image</Text>
            <Text style={styles.uploadButtonSubtext}>Tap to select from gallery · 1:1 recommended</Text>
          </TouchableOpacity>
        )}
      </FormCard>
    </View>
  );
};

// ─── Step 2 ──────────────────────────────────────────────────────────────────

const Step2GovernanceSettings = ({
  theme,
  formData,
  errors,
  updateField,
  selectedToken,
  tokenDetails,
  fetchingToken,
  tokenError,
  onOpenTokenSelector,
  creationFees,
  fetchingFees,
  formatTokenFee,
  formatEthFee,
  PAYMENT_METHODS,
  chainSymbol,
}) => {
  const styles = createStyles(theme);
  const tokenPaymentAvailable = !!creationFees.feeTokenSymbol;

  return (
    <View style={styles.stepContainer}>
      <SectionHeader
        theme={theme}
        icon="options-outline"
        title="Governance Settings"
        description="Configure how your community will govern and make decisions onchain."
      />

      <FormCard theme={theme} title="Governance Token">
        <TouchableOpacity style={styles.tokenSelectorButton} onPress={onOpenTokenSelector} activeOpacity={0.8}>
          <View style={styles.tokenSelectorLeft}>
            {selectedToken && selectedToken.logoURI ? (
              <Image source={{ uri: selectedToken.logoURI }} style={styles.tokenSelectorLogo} />
            ) : (
              <View style={styles.tokenSelectorLogoPlaceholder}>
                <Ionicons name="diamond-outline" size={20} color={theme.COLORS.primary} />
              </View>
            )}
            <View style={styles.tokenSelectorInfo}>
              {selectedToken && !selectedToken.isCustom ? (
                <>
                  <Text style={styles.tokenSelectorSymbol}>{selectedToken.symbol}</Text>
                  <Text style={styles.tokenSelectorName} numberOfLines={1}>{selectedToken.name}</Text>
                </>
              ) : formData.tokenAddress ? (
                <>
                  <Text style={styles.tokenSelectorSymbol}>Custom Token</Text>
                  <Text style={styles.tokenSelectorName} numberOfLines={1}>
                    {formData.tokenAddress.substring(0, 10)}...
                  </Text>
                </>
              ) : (
                <Text style={styles.tokenSelectorPlaceholder}>Select token or enter address</Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
        </TouchableOpacity>

        {errors.tokenAddress && <Text style={styles.errorText}>{errors.tokenAddress}</Text>}

        {fetchingToken && (
          <View style={styles.tokenDetailsLoading}>
            <ActivityIndicator size="small" color={theme.COLORS.primary} />
            <Text style={styles.tokenDetailsLoadingText}>Verifying token contract...</Text>
          </View>
        )}

        {tokenError && !fetchingToken && (
          <View style={styles.tokenDetailsError}>
            <Ionicons name="alert-circle" size={18} color={theme.COLORS.error} />
            <Text style={styles.tokenErrorText}>{tokenError}</Text>
          </View>
        )}

        {tokenDetails && !fetchingToken && !tokenError && (
          <View style={styles.tokenDetailsCard}>
            <View style={styles.tokenDetailsHeader}>
              <Ionicons name="checkmark-circle" size={18} color={theme.COLORS.success} />
              <Text style={styles.tokenDetailsTitle}>Token Verified</Text>
            </View>
            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Name</Text>
              <Text style={styles.tokenDetailValue}>{tokenDetails.name}</Text>
            </View>
            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Symbol</Text>
              <Text style={styles.tokenDetailValue}>{tokenDetails.symbol}</Text>
            </View>
            <View style={styles.tokenDetailRow}>
              <Text style={styles.tokenDetailLabel}>Total Supply</Text>
              <Text style={styles.tokenDetailValue}>
                {(Number(tokenDetails.totalSupply) / Math.pow(10, tokenDetails.decimals)).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.helperText}>Members vote with this token's balance. Pick from the list or paste a custom ERC-20 address.</Text>
      </FormCard>

      <FormCard theme={theme} title="Voting Rules">
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Quorum (%)</Text>
            <TextInput
              style={[styles.input, errors.quorum && styles.inputError]}
              placeholder="50"
              placeholderTextColor={theme.COLORS.textTertiary}
              value={formData.quorum}
              onChangeText={(text) => updateField("quorum", text)}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Proposal Threshold</Text>
            <TextInput
              style={[styles.input, errors.threshold && styles.inputError]}
              placeholder="100"
              placeholderTextColor={theme.COLORS.textTertiary}
              value={formData.threshold}
              onChangeText={(text) => updateField("threshold", text)}
              keyboardType="numeric"
            />
          </View>
        </View>
        {(errors.quorum || errors.threshold) && (
          <Text style={styles.errorText}>{errors.quorum || errors.threshold}</Text>
        )}

        <View style={[styles.fieldRow, { marginTop: theme.SPACING.md }]}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Voting Period (h)</Text>
            <TextInput
              style={[styles.input, errors.votingPeriodHours && styles.inputError]}
              placeholder="72"
              placeholderTextColor={theme.COLORS.textTertiary}
              value={formData.votingPeriodHours}
              onChangeText={(text) => updateField("votingPeriodHours", text)}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Timelock (h)</Text>
            <TextInput
              style={[styles.input, errors.timelockPeriodHours && styles.inputError]}
              placeholder="24"
              placeholderTextColor={theme.COLORS.textTertiary}
              value={formData.timelockPeriodHours}
              onChangeText={(text) => updateField("timelockPeriodHours", text)}
              keyboardType="numeric"
            />
          </View>
        </View>
        {(errors.votingPeriodHours || errors.timelockPeriodHours) && (
          <Text style={styles.errorText}>{errors.votingPeriodHours || errors.timelockPeriodHours}</Text>
        )}

        <Text style={[styles.helperText, { marginTop: theme.SPACING.sm }]}>
          Quorum: % of supply needed to pass a vote. Threshold: minimum tokens to submit a proposal.
          Timelock minimum on this chain: {creationFees.minTimelock || 1}h.
        </Text>
      </FormCard>

      <FormCard theme={theme} title="Creation Fee">
        <PaymentOption
          theme={theme}
          selected={formData.paymentMethod === PAYMENT_METHODS.ETH}
          onPress={() => updateField("paymentMethod", PAYMENT_METHODS.ETH)}
          icon="flash"
          title={`Pay with ${chainSymbol}`}
          fee={
            fetchingFees
              ? "Fetching fee..."
              : creationFees.ethFee != null
                ? `Fee: ${formatEthFee(creationFees.ethFee)} ${chainSymbol}`
                : "..."
          }
        />

        <View style={{ height: theme.SPACING.sm }} />

        <PaymentOption
          theme={theme}
          selected={formData.paymentMethod === PAYMENT_METHODS.TOKEN}
          onPress={() => tokenPaymentAvailable && updateField("paymentMethod", PAYMENT_METHODS.TOKEN)}
          disabled={!tokenPaymentAvailable}
          icon="pricetag"
          title={tokenPaymentAvailable ? `Pay with ${creationFees.feeTokenSymbol}` : "Pay with Token"}
          fee={
            !tokenPaymentAvailable
              ? fetchingFees
                ? "Checking availability..."
                : "Not configured on this chain"
              : `Fee: ${formatTokenFee(creationFees.tokenFee)} ${creationFees.feeTokenSymbol}`
          }
        />

        {errors.paymentMethod && <Text style={styles.errorText}>{errors.paymentMethod}</Text>}
      </FormCard>
    </View>
  );
};

const PaymentOption = ({ theme, selected, onPress, disabled, icon, title, fee }) => {
  const styles = createStyles(theme);
  return (
    <TouchableOpacity
      style={[
        styles.paymentOption,
        selected && styles.paymentOptionSelected,
        disabled && styles.paymentOptionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <View style={[styles.paymentIconWrap, selected && styles.paymentIconWrapSelected]}>
        <Ionicons
          name={icon}
          size={18}
          color={selected ? theme.COLORS.onPrimary : theme.COLORS.textSecondary}
        />
      </View>
      <View style={styles.paymentOptionContent}>
        <Text style={styles.paymentOptionTitle}>{title}</Text>
        <Text style={styles.paymentOptionFee}>{fee}</Text>
      </View>
      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={20}
        color={selected ? theme.COLORS.primary : theme.COLORS.textTertiary}
      />
    </TouchableOpacity>
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
      paddingBottom: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "700",
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
    warningContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.COLORS.warning}18`,
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
      fontWeight: "600",
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.SPACING.lg,
    },
    stepContainer: {
      paddingTop: theme.SPACING.sm,
      paddingBottom: theme.SPACING.xl,
    },
    inputGroup: {
      marginBottom: theme.SPACING.lg,
    },
    fieldRow: {
      flexDirection: "row",
      gap: theme.SPACING.md,
    },
    fieldHalf: {
      flex: 1,
    },
    label: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "600",
      color: theme.COLORS.textSecondary,
      marginBottom: theme.SPACING.xs,
    },
    input: {
      backgroundColor: theme.COLORS.background,
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
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
      marginTop: theme.SPACING.xs,
      lineHeight: 17,
    },
    errorText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.error,
      marginTop: theme.SPACING.xs,
      fontWeight: "600",
    },
    genreGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.SPACING.sm,
    },
    genreChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      borderRadius: theme.BORDER_RADIUS.round,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.background,
    },
    genreChipSelected: {
      borderColor: theme.COLORS.primary,
      backgroundColor: theme.COLORS.primary,
    },
    genreChipText: {
      fontSize: theme.FONTS.sizes.xs,
      fontWeight: "600",
      color: theme.COLORS.textSecondary,
    },
    genreChipTextSelected: {
      color: theme.COLORS.onPrimary,
    },
    uploadButton: {
      borderWidth: 1.5,
      borderColor: theme.COLORS.border,
      borderStyle: "dashed",
      borderRadius: theme.BORDER_RADIUS.lg,
      padding: theme.SPACING.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    uploadButtonText: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "700",
      color: theme.COLORS.text,
      marginTop: theme.SPACING.sm,
    },
    uploadButtonSubtext: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
      marginTop: 2,
    },
    imagePreviewContainer: {
      position: "relative",
      alignItems: "center",
    },
    imagePreview: {
      width: "100%",
      height: 180,
      borderRadius: theme.BORDER_RADIUS.lg,
      backgroundColor: theme.COLORS.background,
    },
    removeImageButton: {
      position: "absolute",
      top: theme.SPACING.sm,
      right: theme.SPACING.sm,
      backgroundColor: theme.COLORS.card,
      borderRadius: 12,
      padding: 2,
    },
    changeImageButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.SPACING.md,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.primary}18`,
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
      backgroundColor: theme.COLORS.background,
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
      backgroundColor: `${theme.COLORS.primary}18`,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.SPACING.sm,
    },
    tokenSelectorInfo: {
      flex: 1,
    },
    tokenSelectorSymbol: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "700",
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
      gap: theme.SPACING.sm,
    },
    tokenDetailsLoadingText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
    },
    tokenDetailsError: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.SPACING.md,
      marginTop: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.error}10`,
      borderRadius: theme.BORDER_RADIUS.md,
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
    },
    tokenDetailsHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.SPACING.sm,
      gap: theme.SPACING.xs,
    },
    tokenDetailsTitle: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "700",
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
    paymentOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.md,
      padding: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      borderWidth: 1.5,
      borderColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.background,
    },
    paymentOptionSelected: {
      borderColor: theme.COLORS.primary,
      backgroundColor: `${theme.COLORS.primary}10`,
    },
    paymentOptionDisabled: {
      opacity: 0.5,
    },
    paymentIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.COLORS.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    paymentIconWrapSelected: {
      backgroundColor: theme.COLORS.primary,
    },
    paymentOptionContent: {
      flex: 1,
    },
    paymentOptionTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "700",
      color: theme.COLORS.text,
    },
    paymentOptionFee: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      marginTop: 2,
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
      color: theme.COLORS.onPrimary,
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
