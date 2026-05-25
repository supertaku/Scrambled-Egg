import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <AlertCircle color={colors.danger} size={48} />
            <Text style={styles.title}>Something went wrong</Text>
            <Text selectable style={styles.message}>
              An unexpected error occurred in the application. You can try to reload the current screen.
            </Text>
            {this.state.error && (
              <View style={styles.errorBox}>
                <Text selectable style={styles.errorText}>{this.state.error.message}</Text>
              </View>
            )}
            <Pressable onPress={this.handleReset} style={styles.button}>
              <RefreshCw color={colors.white} size={18} />
              <Text style={styles.buttonText}>Reload Screen</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 24,
    textAlign: "center",
    width: "100%"
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8
  },
  message: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  errorBox: {
    backgroundColor: "#FFF1F0",
    borderRadius: 12,
    marginTop: 8,
    padding: 12,
    width: "100%"
  },
  errorText: {
    color: colors.danger,
    fontFamily: "monospace",
    fontSize: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 24,
    width: "100%"
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900"
  }
});
