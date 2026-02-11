import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp, SlideInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { useChat, Conversation } from "@/lib/chat-context";
import Colors from "@/constants/colors";

function ConversationItem({
  item,
  onPress,
  onDelete,
}: {
  item: Conversation;
  onPress: () => void;
  onDelete: () => void;
}) {
  const lastMessage = item.messages[item.messages.length - 1];
  const preview = lastMessage?.content.slice(0, 60) || "Start a new conversation";
  const timeAgo = getTimeAgo(item.updatedAt);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.convoItem,
        pressed && styles.convoItemPressed,
      ]}
      onPress={onPress}
      onLongPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onDelete();
      }}
    >
      <View style={styles.convoIcon}>
        <Ionicons name="chatbubble" size={20} color={Colors.emerald} />
      </View>
      <View style={styles.convoContent}>
        <View style={styles.convoHeader}>
          <Text style={styles.convoTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.convoTime}>{timeAgo}</Text>
        </View>
        <Text style={styles.convoPreview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.dark.secondaryText} />
    </Pressable>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { conversations, createConversation, deleteConversation } = useChat();

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const handleNewChat = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const id = createConversation();
    router.push({ pathname: "/chat", params: { id } });
  }, [createConversation]);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (Platform.OS === "web") {
        deleteConversation(id);
        return;
      }
      Alert.alert("Delete Chat", "This conversation will be permanently deleted.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteConversation(id),
        },
      ]);
    },
    [deleteConversation]
  );

  const handleLock = useCallback(() => {
    logout();
    router.replace("/");
  }, [logout]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationItem
        item={item}
        onPress={() => router.push({ pathname: "/chat", params: { id: item.id } })}
        onDelete={() => handleDeleteConversation(item.id)}
      />
    ),
    [handleDeleteConversation]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="shield-checkmark" size={40} color={Colors.emerald} />
      </View>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a secure chat with Grok 4
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset,
        },
      ]}
    >
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDot} />
          <Text style={styles.headerTitle}>SecureClaw</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleLock} hitSlop={12}>
            <Ionicons name="lock-closed" size={20} color={Colors.dark.secondaryText} />
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.securityBar}>
        <Ionicons name="shield" size={12} color={Colors.emerald} />
        <Text style={styles.securityText}>
          End-to-end encrypted | Sandbox: all | Grok 4
        </Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + webBottomInset + 80 },
          conversations.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      <Animated.View
        entering={SlideInRight.delay(300).duration(400)}
        style={[styles.fabContainer, { bottom: insets.bottom + webBottomInset + 24 }]}
      >
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={handleNewChat}
        >
          <Ionicons name="add" size={28} color="#0D1117" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.emerald,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
    color: Colors.dark.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  securityBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  securityText: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    color: "rgba(0, 217, 166, 0.5)",
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyList: {
    flex: 1,
  },
  convoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  convoItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  convoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0, 217, 166, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  convoContent: {
    flex: 1,
    gap: 4,
  },
  convoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convoTitle: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
    flex: 1,
    marginRight: 8,
  },
  convoTime: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  convoPreview: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 217, 166, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 217, 166, 0.15)",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    textAlign: "center",
  },
  fabContainer: {
    position: "absolute",
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.emerald,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
});
