import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Burada hatayı logging servisine gönderebilirsiniz
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={60} color={theme.colors.error} style={styles.icon} />
            <Text style={styles.title}>Bir Hata Oluştu</Text>
            <Text style={styles.message}>
              Uygulamada beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
            </Text>
            
            {this.props.showDetails && this.state.error && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Hata Detayları:</Text>
                <Text style={styles.detailsText}>{this.state.error.toString()}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Ionicons name="refresh" size={20} color={theme.colors.white} style={styles.retryIcon} />
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.screenPadding,
  },
  errorCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.spacing.shadow.lg,
    width: '100%',
    maxWidth: 400,
  },
  icon: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.lineHeight.normal,
  },
  detailsContainer: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.xl,
    width: '100%',
  },
  detailsTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  detailsText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.borderRadius.base,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    width: '100%',
    ...theme.spacing.shadow.base,
  },
  retryIcon: {
    marginRight: theme.spacing.sm,
  },
  retryText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
});

export default ErrorBoundary;