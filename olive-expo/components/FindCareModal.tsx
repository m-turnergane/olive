/**
 * FindCareModal
 * Displays mental health care provider search results
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from "react-native";

interface CareProvider {
  name: string;
  address: string;
  rating: number;
  user_ratings_total: number;
  phone?: string;
  website?: string;
  url: string; // Google Maps URL
  place_id: string;
  types?: string[];
  location?: {
    lat: number;
    lng: number;
  };
}

interface FindCareModalProps {
  visible: boolean;
  onClose: () => void;
  providers?: CareProvider[];
  loading?: boolean;
  error?: string;
  onRefine?: (query: string) => void;
  userLocation?: { lat: number; lng: number };
}

const FindCareModal: React.FC<FindCareModalProps> = ({
  visible,
  onClose,
  providers = [],
  loading = false,
  error,
  onRefine,
  userLocation,
}) => {
  const handleCall = (phone: string) => {
    const phoneUrl = `tel:${phone.replace(/[^\d+]/g, "")}`;
    Linking.openURL(phoneUrl);
  };

  const handleOpenMap = (url: string) => {
    Linking.openURL(url);
  };

  const handleOpenWebsite = (website: string) => {
    Linking.openURL(website);
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in km
  };

  const getDistanceText = (provider: CareProvider): string | null => {
    if (!userLocation || !provider.location) return null;
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      provider.location.lat,
      provider.location.lng
    );
    return distance < 1
      ? `${Math.round(distance * 1000)}m`
      : `${distance.toFixed(1)}km`;
  };

  const refineOptions = [
    "Therapist",
    "Psychologist",
    "Psychiatrist",
    "Grief",
    "Anxiety",
    "Couples",
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Care Providers Near You</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#5E8C61" />
                <Text style={styles.loadingText}>Okay, searching now...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && providers.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No providers found in your area.
                </Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your search radius in Settings.
                </Text>
              </View>
            )}

            {!loading &&
              !error &&
              providers.map((provider, index) => (
                <View key={provider.place_id} style={styles.providerCard}>
                  {/* Provider Name & Rating */}
                  <View style={styles.providerHeader}>
                    <Text style={styles.providerName} numberOfLines={2}>
                      {provider.name}
                    </Text>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.ratingText}>★ {provider.rating}</Text>
                      <Text style={styles.reviewCount}>
                        ({provider.user_ratings_total})
                      </Text>
                    </View>
                  </View>

                  {/* Address & Distance */}
                  <View style={styles.addressRow}>
                    <Text style={styles.address} numberOfLines={2}>
                      {provider.address}
                    </Text>
                    {getDistanceText(provider) && (
                      <Text style={styles.distance}>
                        {getDistanceText(provider)}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.mapButton]}
                      onPress={() => handleOpenMap(provider.url)}
                    >
                      <Text style={styles.actionButtonText}>📍 Map</Text>
                    </TouchableOpacity>

                    {provider.phone && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.callButton]}
                        onPress={() => handleCall(provider.phone!)}
                      >
                        <Text style={styles.actionButtonText}>📞 Call</Text>
                      </TouchableOpacity>
                    )}

                    {provider.website && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.websiteButton]}
                        onPress={() => handleOpenWebsite(provider.website!)}
                      >
                        <Text style={styles.actionButtonText}>🌐 Web</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            {/* Refine Search */}
            {!loading && providers.length > 0 && onRefine && (
              <View style={styles.refineContainer}>
                <Text style={styles.refineTitle}>Refine Search:</Text>
                <View style={styles.refineChips}>
                  {refineOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={styles.refineChip}
                      onPress={() => onRefine(option.toLowerCase())}
                    >
                      <Text style={styles.refineChipText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          {!loading && providers.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Powered by Google Places</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#F0F4F1",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(94, 140, 97, 0.2)",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1B3A2F",
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(27, 58, 47, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: "#1B3A2F",
    fontWeight: "bold",
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "rgba(27, 58, 47, 0.7)",
  },
  errorContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "rgba(27, 58, 47, 0.7)",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.5)",
    textAlign: "center",
  },
  providerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  providerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1B3A2F",
    flex: 1,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#5E8C61",
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.6)",
  },
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  address: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.7)",
    lineHeight: 20,
    flex: 1,
  },
  distance: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5E8C61",
    backgroundColor: "rgba(94, 140, 97, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mapButton: {
    backgroundColor: "#5E8C61",
  },
  callButton: {
    backgroundColor: "#3B82F6",
  },
  websiteButton: {
    backgroundColor: "#8B5CF6",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  refineContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(94, 140, 97, 0.2)",
  },
  refineTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1B3A2F",
    marginBottom: 12,
  },
  refineChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  refineChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.3)",
  },
  refineChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#5E8C61",
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(94, 140, 97, 0.2)",
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "rgba(27, 58, 47, 0.5)",
  },
});

export default FindCareModal;
