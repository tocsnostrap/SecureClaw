import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, biometricType, authenticate } = useAuth();

  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace("/conversations");
    }
  }, [isAuthenticated, isLoading]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  async function handleUnlock() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const success = await authenticate();
    if (success) {
      router.replace("/conversations");
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.emerald} />
      </View>
    );
  }

  if (isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.emerald} />
      </View>
    );
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + webBottomInset,
        },
      ]}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrapper, pulseStyle]}>
          <Animated.View style={[styles.glowRing, glowStyle]} />
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={Colors.emerald} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(600)}>
          <Text style={styles.title}>SecureClaw</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(600)}>
          <Text style={styles.subtitle}>
            Secure AI Assistant powered by Grok 4
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(600).duration(600)}
          style={styles.securityBadges}
        >
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={14} color={Colors.emerald} />
            <Text style={styles.badgeText}>E2E Encrypted</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="finger-print" size={14} color={Colors.emerald} />
            <Text style={styles.badgeText}>Biometric Auth</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="cube" size={14} color={Colors.emerald} />
            <Text style={styles.badgeText}>Sandboxed</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInUp.delay(800).duration(600)}
        style={styles.bottom}
      >
        <Pressable
          style={({ pressed }) => [
            styles.unlockButton,
            pressed && styles.unlockButtonPressed,
          ]}
          onPress={handleUnlock}
        >
          <Ionicons
            name={
              biometricType === "Face ID"
                ? "scan"
                : biometricType === "Touch ID"
                ? "finger-print"
                : "key"
            }
            size={22}
            color="#0D1117"
          />
          <Text style={styles.unlockText}>
            {biometricType
              ? `Unlock with ${biometricType}`
              : "Unlock"}
          </Text>
        </Pressable>

        <Text style={styles.versionText}>v1.0.0 | dmPolicy: pairing</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  glowRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.emerald,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0, 217, 166, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 217, 166, 0.2)",
  },
  title: {
    fontSize: 34,
    fontFamily: "SpaceGrotesk_700Bold",
    color: Colors.dark.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    textAlign: "center",
    marginBottom: 32,
  },
  securityBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0, 217, 166, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 217, 166, 0.15)",
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_500Medium",
    color: Colors.dark.secondaryText,
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    alignItems: "center",
    gap: 16,
  },
  unlockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.emerald,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
  },
  unlockButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  unlockText: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: "#0D1117",
  },
  versionText: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    color: "rgba(139, 148, 158, 0.5)",
  },
});
