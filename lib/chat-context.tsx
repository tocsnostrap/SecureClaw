import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface ChatContextValue {
  conversations: Conversation[];
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  getConversation: (id: string) => Conversation | undefined;
  updateConversation: (id: string, messages: Message[]) => void;
  isLoaded: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = "secureclaw_conversations";

let messageCounter = 0;
export function generateUniqueId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      loadConversations();
      initializedRef.current = true;
    }
  }, []);

  async function loadConversations() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConversations(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
    setIsLoaded(true);
  }

  async function saveConversations(convos: Conversation[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
    } catch (e) {
      console.error("Failed to save conversations:", e);
    }
  }

  function createConversation(): string {
    const id = generateUniqueId();
    const newConvo: Conversation = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newConvo, ...conversations];
    setConversations(updated);
    saveConversations(updated);
    return id;
  }

  function deleteConversation(id: string) {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    saveConversations(updated);
  }

  function getConversation(id: string): Conversation | undefined {
    return conversations.find((c) => c.id === id);
  }

  function updateConversation(id: string, messages: Message[]) {
    const updated = conversations.map((c) => {
      if (c.id === id) {
        const title =
          messages.find((m) => m.role === "user")?.content.slice(0, 40) ||
          "New Chat";
        return { ...c, messages, title, updatedAt: Date.now() };
      }
      return c;
    });
    setConversations(updated);
    saveConversations(updated);
  }

  const value = useMemo(
    () => ({
      conversations,
      createConversation,
      deleteConversation,
      getConversation,
      updateConversation,
      isLoaded,
    }),
    [conversations, isLoaded]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
