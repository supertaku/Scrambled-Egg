import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useModelDownload } from '@/hooks/useModelDownload';
import { Download, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export const ModelDownloader: React.FC = () => {
  const {
    recommendedTier,
    isDownloaded,
    isDownloading,
    progress,
    error,
    startDownload,
    deleteModel
  } = useModelDownload();

  if (recommendedTier === 'unknown') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Local AI Intelligence</Text>
            <Text style={styles.subtitle}>
              Tier: <Text style={styles.tierHighlight}>{recommendedTier.toUpperCase()}</Text>
            </Text>
          </View>
          {isDownloaded ? (
            <CheckCircle2 color="#4ADE80" size={24} />
          ) : (
            <Download color="#94A3B8" size={24} />
          )}
        </View>

        <Text style={styles.description}>
          {isDownloaded
            ? "Your local AI model is ready. You can now chat and summarize documents entirely offline."
            : `Haki recommends the ${recommendedTier} model for your device. Download it to enable fast, private, offline AI features.`}
        </Text>

        {isDownloading && progress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${progress.overallProgress * 100}%` }
                ]} 
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>
                Downloading {progress.currentFile}...
              </Text>
              <Text style={styles.percentText}>
                {Math.round(progress.overallProgress * 100)}%
              </Text>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle color="#F87171" size={16} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.footer}>
          {!isDownloaded && !isDownloading && (
            <TouchableOpacity 
              style={styles.downloadButton} 
              onPress={() => startDownload()}
            >
              <Text style={styles.buttonText}>Download AI Model</Text>
            </TouchableOpacity>
          )}

          {isDownloading && (
            <View style={styles.downloadingBadge}>
              <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Downloading...</Text>
            </View>
          )}

          {isDownloaded && !isDownloading && (
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => deleteModel()}
            >
              <Trash2 color="#94A3B8" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>Remove Model</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    width: '100%',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  tierHighlight: {
    color: '#6366F1',
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#CBD5E1',
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  percentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  downloadButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadingBadge: {
    backgroundColor: '#475569',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
});
