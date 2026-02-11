import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { useChat, Message, generateUniqueId } from "@/lib/chat-context";
import Colors from "@/constants/colors";

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
      ]}
    >
      {!isUser && (
        <View style={styles.avatarCircle}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.emerald} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
          ]}
          selectable
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={styles.avatarCircle}>
        <Ionicons name="shield-checkmark" size={14} color={Colors.emerald} />
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <Animated.View
            entering={FadeIn.delay(0).duration(400)}
            style={styles.dot}
          />
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            style={styles.dot}
          />
          <Animated.View
            entering={FadeIn.delay(400).duration(400)}
            style={styles.dot}
          />
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getConversation, updateConversation } = useChat();
  const inputRef = useRef<TextInput>(null);
  const initializedRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [lastToolCalls, setLastToolCalls] = useState<any[]>([]);

  useEffect(() => {
    if (!initializedRef.current && id) {
      const convo = getConversation(id);
      if (convo?.messages) {
        setMessages(convo.messages);
      }
      initializedRef.current = true;
    }
  }, [id]);

  useEffect(() => {
    if (id && initializedRef.current && messages.length > 0 && !isStreaming) {
      updateConversation(id, messages);
    }
  }, [isStreaming]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const currentMessages = [...messages];
    const userMessage: Message = {
      id: generateUniqueId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedWithUser = [...currentMessages, userMessage];
    setMessages(updatedWithUser);
    setInputText("");
    setIsStreaming(true);
    setShowTyping(true);

    let fullContent = "";
    let assistantAdded = false;

    try {
      const baseUrl = getApiUrl();
      const chatHistory = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      const response = await fetch(`${baseUrl}api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.toolCalls) {
              setLastToolCalls(parsed.toolCalls);
              if (parsed.agent) setActiveAgent(parsed.agent);
            }
            if (parsed.content) {
              fullContent += parsed.content;

              if (!assistantAdded) {
                setShowTyping(false);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateUniqueId(),
                    role: "assistant",
                    content: fullContent,
                    timestamp: Date.now(),
                  },
                ]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              }
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) {
              throw parseErr;
            }
          }
        }
      }
    } catch (error: any) {
      setShowTyping(false);
      const errorMsg =
        error.message?.includes("503") || error.message?.includes("not configured")
          ? "AI service is not configured. Please set your XAI_API_KEY."
          : `Connection error: ${error.message}`;

      if (!assistantAdded) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateUniqueId(),
            role: "assistant",
            content: errorMsg,
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
    }
  }, [inputText, isStreaming, messages, id, updateConversation]);

  const reversedMessages = [...messages].reverse();

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerStatusDot} />
          <Text style={styles.headerTitle}>
            {activeAgent ? `${activeAgent}` : "Grok 4"}
          </Text>
          {activeAgent && (
            <View style={styles.agentBadge}>
              <MaterialCommunityIcons name="brain" size={10} color={Colors.emerald} />
            </View>
          )}
          <View style={styles.encryptedBadge}>
            <Ionicons name="lock-closed" size={10} color={Colors.emerald} />
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          inverted={messages.length > 0}
          ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatIcon}>
                <Ionicons name="shield-checkmark" size={32} color={Colors.emerald} />
              </View>
              <Text style={styles.emptyChatTitle}>Secure Channel Open</Text>
              <Text style={styles.emptyChatSubtitle}>
                Messages are encrypted end-to-end.{"\n"}
                Ask anything.
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyMessageList,
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Math.max(insets.bottom, webBottomInset) + 8 },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Message SecureClaw..."
              placeholderTextColor="rgba(139, 148, 158, 0.5)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={5000}
              blurOnSubmit={false}
              editable={!isStreaming}
            />
            <Pressable
              onPress={() => {
                handleSend();
                inputRef.current?.focus();
              }}
              disabled={!inputText.trim() || isStreaming}
              style={({ pressed }) => [
                styles.sendButton,
                (!inputText.trim() || isStreaming) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#0D1117" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#0D1117" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.emerald,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  agentBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 217, 166, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  encryptedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 217, 166, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyMessageList: {
    flex: 1,
    justifyContent: "center",
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 4,
    alignItems: "flex-end",
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowAssistant: {
    justifyContent: "flex-start",
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 217, 166, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 217, 166, 0.2)",
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: Colors.emerald,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.dark.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_400Regular",
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: "#0D1117",
  },
  bubbleTextAssistant: {
    color: Colors.dark.text,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.secondaryText,
  },
  emptyChat: {
    alignItems: "center",
    gap: 8,
    transform: [{ scaleY: -1 }],
  },
  emptyChatIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 217, 166, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 217, 166, 0.15)",
  },
  emptyChatTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.dark.surface,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.emerald,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(0, 217, 166, 0.2)",
  },
  sendButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
});
