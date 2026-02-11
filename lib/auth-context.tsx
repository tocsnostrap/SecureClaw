import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricType: string | null;
  authenticate: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  async function checkBiometricSupport() {
    try {
      if (Platform.OS === "web") {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("Touch ID");
      } else {
        setBiometricType("Passcode");
      }

      if (!hasHardware || !isEnrolled) {
        setIsAuthenticated(true);
      }

      setIsLoading(false);
    } catch {
      setIsAuthenticated(true);
      setIsLoading(false);
    }
  }

  async function authenticate(): Promise<boolean> {
    if (Platform.OS === "web") {
      setIsAuthenticated(true);
      return true;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to access SecureClaw",
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAuthenticated(true);
        await AsyncStorage.setItem("secureclaw_last_auth", Date.now().toString());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function logout() {
    setIsAuthenticated(false);
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      biometricType,
      authenticate,
      logout,
    }),
    [isAuthenticated, isLoading, biometricType]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
