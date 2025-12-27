/**
 * Onboarding Screen
 * Multi-step wizard for first-time setup
 * Includes QR code scanner (using expo-camera), server discovery, API key input, and skip option
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  TextInput,
  ProgressBar,
  IconButton,
} from 'react-native-paper';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../stores/settingsStore';
import { colors, spacing, borderRadius } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * QR Code data format expected from AutoClaude desktop app
 */
interface QRCodeData {
  serverUrl?: string;
  apiKey?: string;
}

/**
 * Onboarding steps configuration
 */
const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AutoClaude',
    description: 'Your mobile companion for AI-powered development automation',
    icon: 'robot-happy',
  },
  {
    id: 'qr-scanner',
    title: 'Connect via QR Code',
    description: 'Scan the QR code from your AutoClaude desktop app to connect instantly',
    icon: 'qrcode-scan',
  },
  {
    id: 'server-discovery',
    title: 'Find Your Server',
    description: 'We can automatically discover AutoClaude servers on your network',
    icon: 'server-network',
  },
  {
    id: 'api-key',
    title: 'Enter API Key',
    description: 'Enter your API key to authenticate with the server',
    icon: 'key-variant',
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'You\'re ready to start managing your AI development workflow',
    icon: 'check-circle',
  },
] as const;

type StepId = typeof STEPS[number]['id'];

/**
 * Onboarding wizard component
 * Guides users through first-time setup with multiple connection options
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<string[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hasScannedRef = useRef(false);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Settings store
  const updateConnectionSettings = useSettingsStore((state) => state.updateConnectionSettings);
  const saveApiKeyToStore = useSettingsStore((state) => state.saveApiKey);
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding);

  const step = STEPS[currentStep];
  const progress = (currentStep + 1) / STEPS.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  /**
   * Reset scan state when leaving QR scanner step
   */
  useEffect(() => {
    if (step.id !== 'qr-scanner') {
      setIsScanning(false);
      hasScannedRef.current = false;
      setScanError(null);
    }
  }, [step.id]);

  /**
   * Animate transition between steps
   */
  const animateTransition = useCallback((direction: 'next' | 'back') => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      if (direction === 'next' && currentStep < STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else if (direction === 'back' && currentStep > 0) {
        setCurrentStep(prev => prev - 1);
      }
    }, 150);
  }, [currentStep, fadeAnim]);

  /**
   * Navigate to next step
   */
  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      animateTransition('next');
    }
  }, [isLastStep, animateTransition]);

  /**
   * Navigate to previous step
   */
  const handleBack = useCallback(() => {
    animateTransition('back');
  }, [animateTransition]);

  /**
   * Skip to specific step
   */
  const skipToStep = useCallback((stepId: StepId) => {
    const stepIndex = STEPS.findIndex(s => s.id === stepId);
    if (stepIndex !== -1 && stepIndex !== currentStep) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setCurrentStep(stepIndex);
      }, 150);
    }
  }, [currentStep, fadeAnim]);

  /**
   * Skip onboarding and go to main app
   */
  const handleSkip = useCallback(() => {
    completeOnboarding();
    router.replace('/(tabs)');
  }, [completeOnboarding]);

  /**
   * Complete onboarding and navigate to main app
   */
  const handleComplete = useCallback(async () => {
    // Save API key if provided
    if (apiKey.trim()) {
      setIsSavingApiKey(true);
      const success = await saveApiKeyToStore(apiKey.trim());
      setIsSavingApiKey(false);

      if (!success) {
        Alert.alert('Error', 'Failed to save API key. Please try again.');
        return;
      }
    }

    // Save server URL if provided
    if (serverUrl.trim()) {
      updateConnectionSettings({
        serverUrl: serverUrl.trim(),
        isConfigured: !!apiKey.trim(),
      });
    }

    // Mark onboarding as complete and store first-launch timestamp
    completeOnboarding();

    router.replace('/(tabs)');
  }, [apiKey, serverUrl, saveApiKeyToStore, updateConnectionSettings, completeOnboarding]);

  /**
   * Parse QR code data
   */
  const parseQRCodeData = useCallback((data: string): QRCodeData | null => {
    try {
      // Try to parse as JSON first (expected format from AutoClaude)
      const parsed = JSON.parse(data);
      if (parsed.serverUrl || parsed.apiKey) {
        return {
          serverUrl: parsed.serverUrl,
          apiKey: parsed.apiKey,
        };
      }
    } catch {
      // Not JSON - try to parse as URL
      try {
        const url = new URL(data);
        // Check if it's a valid HTTP(S) URL
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return { serverUrl: data };
        }
      } catch {
        // Not a valid URL either
      }
    }
    return null;
  }, []);

  /**
   * Handle QR code scan result
   */
  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    // Prevent multiple scans
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    const { data } = result;
    const parsed = parseQRCodeData(data);

    if (parsed) {
      setScanError(null);

      if (parsed.serverUrl) {
        setServerUrl(parsed.serverUrl);
      }

      if (parsed.apiKey) {
        setApiKey(parsed.apiKey);
        // If we got both server URL and API key, skip to completion
        if (parsed.serverUrl) {
          skipToStep('complete');
        } else {
          skipToStep('server-discovery');
        }
      } else if (parsed.serverUrl) {
        // Just server URL, go to API key step
        skipToStep('api-key');
      }

      setIsScanning(false);
    } else {
      setScanError('Invalid QR code format. Please scan a valid AutoClaude QR code.');
      // Allow retry after error
      setTimeout(() => {
        hasScannedRef.current = false;
      }, 2000);
    }
  }, [parseQRCodeData, skipToStep]);

  /**
   * Start QR code scanning
   */
  const handleStartScan = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to scan QR codes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }

    hasScannedRef.current = false;
    setScanError(null);
    setIsScanning(true);
  }, [permission, requestPermission]);

  /**
   * Stop QR code scanning
   */
  const handleStopScan = useCallback(() => {
    setIsScanning(false);
    hasScannedRef.current = false;
    setScanError(null);
  }, []);

  /**
   * Simulate server discovery
   * Note: Real mDNS/network discovery would require native module integration
   */
  const handleDiscoverServers = useCallback(() => {
    setIsDiscovering(true);
    setDiscoveredServers([]);
    // Simulate discovery delay
    setTimeout(() => {
      setDiscoveredServers([
        'http://192.168.1.100:8000',
        'http://192.168.1.101:8000',
      ]);
      setIsDiscovering(false);
    }, 3000);
  }, []);

  /**
   * Select a discovered server
   */
  const handleSelectServer = useCallback((server: string) => {
    setServerUrl(server);
    // Go to API key step
    skipToStep('api-key');
  }, [skipToStep]);

  /**
   * Handle manual server URL submission
   */
  const handleManualServerSubmit = useCallback(() => {
    if (serverUrl.trim()) {
      skipToStep('api-key');
    }
  }, [serverUrl, skipToStep]);

  /**
   * Render step indicator dots
   */
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((_, index) => (
        <View
          key={index}
          style={[
            styles.stepDot,
            index === currentStep && styles.stepDotActive,
            index < currentStep && styles.stepDotCompleted,
          ]}
          accessibilityLabel={`Step ${index + 1} of ${STEPS.length}${
            index === currentStep ? ', current' : ''
          }`}
        />
      ))}
    </View>
  );


  /**
   * Render welcome step content
   */
  const renderWelcomeStep = () => (
    <View style={styles.stepContent}>
      <Surface style={styles.featureCard} elevation={2}>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons
            name="view-dashboard"
            size={24}
            color={colors.accent.primary}
          />
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Kanban Board</Text>
            <Text style={styles.featureDescription}>
              Manage tasks with drag-and-drop simplicity
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={styles.featureCard} elevation={2}>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons
            name="chat-processing"
            size={24}
            color={colors.accent.primary}
          />
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>AI Chat</Text>
            <Text style={styles.featureDescription}>
              Interact with Claude for code insights
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={styles.featureCard} elevation={2}>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons
            name="console"
            size={24}
            color={colors.accent.primary}
          />
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Terminal Viewer</Text>
            <Text style={styles.featureDescription}>
              Monitor command outputs in real-time
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={styles.featureCard} elevation={2}>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons
            name="github"
            size={24}
            color={colors.accent.primary}
          />
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>GitHub Integration</Text>
            <Text style={styles.featureDescription}>
              Review issues and pull requests
            </Text>
          </View>
        </View>
      </Surface>
    </View>
  );

  /**
   * Render QR scanner step content
   */
  const renderQRScannerStep = () => (
    <View style={styles.stepContent}>
      <Surface style={styles.scannerContainer} elevation={2}>
        {isScanning && permission?.granted ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.qrFrame}>
                <View style={[styles.qrCorner, styles.qrCornerTL]} />
                <View style={[styles.qrCorner, styles.qrCornerTR]} />
                <View style={[styles.qrCorner, styles.qrCornerBL]} />
                <View style={[styles.qrCorner, styles.qrCornerBR]} />
              </View>
            </View>
            <IconButton
              icon="close"
              iconColor={colors.text.primary}
              containerColor={colors.background.elevated}
              size={24}
              style={styles.closeScanButton}
              onPress={handleStopScan}
              accessibilityLabel="Stop scanning"
            />
          </View>
        ) : (
          <View style={styles.scannerContent}>
            <View style={styles.qrFrame}>
              <View style={[styles.qrCorner, styles.qrCornerTL]} />
              <View style={[styles.qrCorner, styles.qrCornerTR]} />
              <View style={[styles.qrCorner, styles.qrCornerBL]} />
              <View style={[styles.qrCorner, styles.qrCornerBR]} />
              <MaterialCommunityIcons
                name="camera"
                size={48}
                color={colors.text.muted}
              />
            </View>
            <Text style={styles.placeholderText}>
              {permission?.granted
                ? 'Tap button below to start scanning'
                : 'Camera permission required to scan QR codes'}
            </Text>
          </View>
        )}
      </Surface>

      {scanError && (
        <Surface style={styles.errorCard} elevation={1}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={20}
            color={colors.status.error}
          />
          <Text style={styles.errorText}>{scanError}</Text>
        </Surface>
      )}

      <Button
        mode="contained"
        onPress={isScanning ? handleStopScan : handleStartScan}
        style={styles.actionButton}
        icon={isScanning ? 'stop' : 'qrcode-scan'}
        accessibilityLabel={isScanning ? 'Stop scanning' : 'Start QR code scan'}
        accessibilityHint="Opens camera to scan QR code from desktop app"
      >
        {isScanning ? 'Stop Scanning' : 'Start Scanning'}
      </Button>

      <Text style={styles.orText}>or enter manually</Text>

      <TextInput
        mode="outlined"
        label="Server URL"
        value={serverUrl}
        onChangeText={setServerUrl}
        placeholder="http://192.168.1.100:8000"
        style={styles.input}
        outlineColor={colors.surface.border}
        activeOutlineColor={colors.accent.primary}
        textColor={colors.text.primary}
        placeholderTextColor={colors.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="Server URL input"
        accessibilityHint="Enter the AutoClaude server URL manually"
        right={
          serverUrl.trim() ? (
            <TextInput.Icon
              icon="arrow-right"
              onPress={handleManualServerSubmit}
              accessibilityLabel="Submit server URL"
            />
          ) : undefined
        }
      />
    </View>
  );

  /**
   * Render server discovery step content
   */
  const renderServerDiscoveryStep = () => (
    <View style={styles.stepContent}>
      <Surface style={styles.discoveryCard} elevation={2}>
        <MaterialCommunityIcons
          name="access-point-network"
          size={48}
          color={isDiscovering ? colors.accent.primary : colors.text.muted}
        />
        <Text style={styles.discoveryTitle}>
          {isDiscovering
            ? 'Searching for servers...'
            : discoveredServers.length > 0
            ? `Found ${discoveredServers.length} server${discoveredServers.length === 1 ? '' : 's'}`
            : 'Tap below to search your network'}
        </Text>
        {isDiscovering && (
          <ProgressBar
            indeterminate
            color={colors.accent.primary}
            style={styles.discoveryProgress}
          />
        )}
      </Surface>

      {discoveredServers.length > 0 && (
        <View style={styles.serverList}>
          {discoveredServers.map((server, index) => (
            <Surface key={server} style={styles.serverItem} elevation={1}>
              <View style={styles.serverInfo}>
                <MaterialCommunityIcons
                  name="server"
                  size={24}
                  color={colors.accent.primary}
                />
                <View style={styles.serverTextContainer}>
                  <Text style={styles.serverName}>AutoClaude Server {index + 1}</Text>
                  <Text style={styles.serverUrl}>{server}</Text>
                </View>
              </View>
              <IconButton
                icon="chevron-right"
                iconColor={colors.text.secondary}
                onPress={() => handleSelectServer(server)}
                accessibilityLabel={`Connect to ${server}`}
              />
            </Surface>
          ))}
        </View>
      )}

      <Button
        mode="contained"
        onPress={handleDiscoverServers}
        style={styles.actionButton}
        icon="magnify"
        loading={isDiscovering}
        disabled={isDiscovering}
        accessibilityLabel="Discover servers"
        accessibilityHint="Search for AutoClaude servers on your local network"
      >
        {isDiscovering ? 'Searching...' : 'Discover Servers'}
      </Button>

      <Text style={styles.orText}>or enter manually</Text>

      <TextInput
        mode="outlined"
        label="Server URL"
        value={serverUrl}
        onChangeText={setServerUrl}
        placeholder="http://192.168.1.100:8000"
        style={styles.input}
        outlineColor={colors.surface.border}
        activeOutlineColor={colors.accent.primary}
        textColor={colors.text.primary}
        placeholderTextColor={colors.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="Server URL input"
        accessibilityHint="Enter the AutoClaude server URL manually"
        right={
          serverUrl.trim() ? (
            <TextInput.Icon
              icon="arrow-right"
              onPress={handleManualServerSubmit}
              accessibilityLabel="Submit server URL"
            />
          ) : undefined
        }
      />

      {serverUrl && (
        <Surface style={styles.selectedServer} elevation={1}>
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color={colors.status.success}
          />
          <Text style={styles.selectedServerText}>
            Selected: {serverUrl}
          </Text>
        </Surface>
      )}
    </View>
  );

  /**
   * Render API key input step content
   */
  const renderApiKeyStep = () => (
    <View style={styles.stepContent}>
      {serverUrl && (
        <Surface style={styles.serverInfoCard} elevation={1}>
          <MaterialCommunityIcons
            name="server"
            size={20}
            color={colors.accent.primary}
          />
          <View style={styles.serverInfoTextContainer}>
            <Text style={styles.serverInfoLabel}>Server</Text>
            <Text style={styles.serverInfoValue} numberOfLines={1}>
              {serverUrl}
            </Text>
          </View>
        </Surface>
      )}

      <Surface style={styles.apiKeyCard} elevation={2}>
        <MaterialCommunityIcons
          name="key-variant"
          size={48}
          color={colors.accent.primary}
        />
        <Text style={styles.apiKeyCardTitle}>Enter Your API Key</Text>
        <Text style={styles.apiKeyCardDescription}>
          Your API key is stored securely on your device using encrypted storage.
        </Text>
      </Surface>

      <View style={styles.apiKeyInputContainer}>
        <TextInput
          mode="outlined"
          label="API Key"
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-ant-..."
          style={styles.input}
          outlineColor={colors.surface.border}
          activeOutlineColor={colors.accent.primary}
          textColor={colors.text.primary}
          placeholderTextColor={colors.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showApiKey}
          accessibilityLabel="API key input"
          accessibilityHint="Enter your AutoClaude API key"
          right={
            <TextInput.Icon
              icon={showApiKey ? 'eye-off' : 'eye'}
              onPress={() => setShowApiKey(!showApiKey)}
              accessibilityLabel={showApiKey ? 'Hide API key' : 'Show API key'}
            />
          }
        />
      </View>

      <Surface style={styles.securityNote} elevation={1}>
        <MaterialCommunityIcons
          name="shield-lock"
          size={20}
          color={colors.status.success}
        />
        <Text style={styles.securityNoteText}>
          Your API key is encrypted and stored locally. It is never sent to any server other than your configured AutoClaude instance.
        </Text>
      </Surface>

      {!apiKey.trim() && (
        <Button
          mode="text"
          onPress={handleNext}
          style={styles.skipButton}
          textColor={colors.text.muted}
          accessibilityLabel="Skip API key setup"
          accessibilityHint="Continue without entering an API key"
        >
          Skip for now
        </Button>
      )}
    </View>
  );

  /**
   * Render completion step content
   */
  const renderCompleteStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.completionBadge}>
        <MaterialCommunityIcons
          name="check-circle"
          size={100}
          color={colors.status.success}
        />
      </View>

      <Surface style={styles.summaryCard} elevation={2}>
        <Text style={styles.summaryTitle}>Setup Complete</Text>

        {serverUrl ? (
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons
              name="server"
              size={20}
              color={colors.accent.primary}
            />
            <Text style={styles.summaryText}>
              Server: {serverUrl}
            </Text>
          </View>
        ) : (
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons
              name="information"
              size={20}
              color={colors.text.muted}
            />
            <Text style={styles.summaryTextMuted}>
              No server configured yet
            </Text>
          </View>
        )}

        {apiKey ? (
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons
              name="key"
              size={20}
              color={colors.status.success}
            />
            <Text style={styles.summaryText}>
              API key configured
            </Text>
          </View>
        ) : (
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons
              name="key-outline"
              size={20}
              color={colors.text.muted}
            />
            <Text style={styles.summaryTextMuted}>
              No API key configured
            </Text>
          </View>
        )}
      </Surface>

      <Text style={styles.tipText}>
        Tip: You can always access settings to reconfigure your connection
      </Text>
    </View>
  );

  /**
   * Render current step content
   */
  const renderStepContent = () => {
    switch (step.id) {
      case 'welcome':
        return renderWelcomeStep();
      case 'qr-scanner':
        return renderQRScannerStep();
      case 'server-discovery':
        return renderServerDiscoveryStep();
      case 'api-key':
        return renderApiKeyStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null;
    }
  };

  /**
   * Get the appropriate button label for current step
   */
  const getButtonLabel = (): string => {
    if (isLastStep) {
      return isSavingApiKey ? 'Saving...' : 'Get Started';
    }
    return 'Continue';
  };

  /**
   * Check if continue button should be disabled
   */
  const isContinueDisabled = (): boolean => {
    if (isSavingApiKey) return true;

    // On API key step, we allow skipping but show different button
    if (step.id === 'api-key') {
      return false;
    }

    return false;
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      {/* Header with skip button */}
      <View style={styles.header}>
        {!isFirstStep ? (
          <IconButton
            icon="arrow-left"
            iconColor={colors.text.secondary}
            onPress={handleBack}
            accessibilityLabel="Go back"
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Button
          mode="text"
          onPress={handleSkip}
          textColor={colors.text.secondary}
          compact
          accessibilityLabel="Skip onboarding"
          accessibilityHint="Skip setup and go directly to the app"
        >
          Skip
        </Button>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={progress}
          color={colors.accent.primary}
          style={styles.progressBar}
        />
      </View>

      {/* Step indicator */}
      {renderStepIndicator()}

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.animatedContent, { opacity: fadeAnim }]}>
          {/* Step icon */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={step.icon}
              size={64}
              color={colors.accent.primary}
              accessibilityLabel={`${step.title} icon`}
            />
          </View>

          {/* Step title and description */}
          <Text
            variant="headlineMedium"
            style={styles.title}
            accessibilityRole="header"
          >
            {step.title}
          </Text>
          <Text variant="bodyLarge" style={styles.description}>
            {step.description}
          </Text>

          {/* Step-specific content */}
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleNext}
          style={styles.nextButton}
          contentStyle={styles.nextButtonContent}
          labelStyle={styles.nextButtonLabel}
          loading={isSavingApiKey}
          disabled={isContinueDisabled()}
          accessibilityLabel={isLastStep ? 'Get started' : 'Continue to next step'}
        >
          {getButtonLabel()}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerSpacer: {
    width: 48,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface.border,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: colors.accent.primary,
  },
  stepDotCompleted: {
    backgroundColor: colors.status.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  animatedContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  stepContent: {
    width: '100%',
    alignItems: 'center',
  },
  // Welcome step styles
  featureCard: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  featureTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  featureDescription: {
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: 2,
  },
  // QR Scanner step styles
  scannerContainer: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 280,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  cameraContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  closeScanButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  scannerContent: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrFrame: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.accent.primary,
  },
  qrCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  qrCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  qrCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  qrCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  placeholderText: {
    color: colors.text.muted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.error + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
    gap: spacing.sm,
  },
  errorText: {
    color: colors.status.error,
    flex: 1,
    fontSize: 14,
  },
  actionButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  orText: {
    color: colors.text.muted,
    marginVertical: spacing.sm,
  },
  input: {
    width: '100%',
    backgroundColor: colors.background.secondary,
  },
  // Server discovery step styles
  discoveryCard: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  discoveryTitle: {
    color: colors.text.primary,
    marginTop: spacing.md,
    fontSize: 16,
    textAlign: 'center',
  },
  discoveryProgress: {
    width: '100%',
    marginTop: spacing.md,
    height: 4,
    borderRadius: 2,
  },
  serverList: {
    width: '100%',
    marginBottom: spacing.md,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serverTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  serverName: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  serverUrl: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  selectedServer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    width: '100%',
  },
  selectedServerText: {
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    fontSize: 14,
    flex: 1,
  },
  // API key step styles
  serverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  serverInfoTextContainer: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  serverInfoLabel: {
    color: colors.text.muted,
    fontSize: 12,
  },
  serverInfoValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  apiKeyCard: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  apiKeyCardTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  apiKeyCardDescription: {
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  apiKeyInputContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.status.success + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    gap: spacing.sm,
  },
  securityNoteText: {
    color: colors.text.secondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  skipButton: {
    marginTop: spacing.md,
  },
  // Complete step styles
  completionBadge: {
    marginBottom: spacing.xl,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  summaryText: {
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  summaryTextMuted: {
    color: colors.text.muted,
    marginLeft: spacing.sm,
    flex: 1,
  },
  tipText: {
    color: colors.text.muted,
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  // Footer styles
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  nextButton: {
    borderRadius: borderRadius.lg,
  },
  nextButtonContent: {
    paddingVertical: spacing.sm,
  },
  nextButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
