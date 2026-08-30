import { create } from 'zustand';
import type { PresenceState } from '@/types';

interface TypingEntry {
  userId: string;
  displayName: string;
  at: number;
}

interface ChatState {
  activeConversationId: string | null;
  typingByConversation: Record<string, TypingEntry[]>;
  presence: Record<string, PresenceState>;
  readReceipts: Record<string, Record<string, string>>;

  setActiveConversation: (id: string | null) => void;
  setTyping: (conversationId: string, entry: TypingEntry, isTyping: boolean) => void;
  pruneTyping: () => void;
  setPresence: (entry: PresenceState) => void;
  setPresenceBulk: (entries: PresenceState[]) => void;
  setReadReceipt: (conversationId: string, userId: string, readAt: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  typingByConversation: {},
  presence: {},
  readReceipts: {},

  setActiveConversation: (activeConversationId) => set({ activeConversationId }),

  setTyping: (conversationId, entry, isTyping) =>
    set((state) => {
      const current = state.typingByConversation[conversationId] ?? [];
      const without = current.filter((item) => item.userId !== entry.userId);
      return {
        typingByConversation: {
          ...state.typingByConversation,
          [conversationId]: isTyping ? [...without, entry] : without,
        },
      };
    }),

  // Typing indicators self-expire in case a "stopped typing" event is lost.
  pruneTyping: () =>
    set((state) => {
      const cutoff = Date.now() - 6000;
      const next: Record<string, TypingEntry[]> = {};
      let changed = false;
      for (const [conversationId, entries] of Object.entries(state.typingByConversation)) {
        const kept = entries.filter((entry) => entry.at > cutoff);
        if (kept.length !== entries.length) changed = true;
        next[conversationId] = kept;
      }
      return changed ? { typingByConversation: next } : state;
    }),

  setPresence: (entry) =>
    set((state) => ({ presence: { ...state.presence, [entry.userId]: entry } })),

  setPresenceBulk: (entries) =>
    set((state) => {
      const next = { ...state.presence };
      for (const entry of entries) next[entry.userId] = entry;
      return { presence: next };
    }),

  setReadReceipt: (conversationId, userId, readAt) =>
    set((state) => ({
      readReceipts: {
        ...state.readReceipts,
        [conversationId]: { ...(state.readReceipts[conversationId] ?? {}), [userId]: readAt },
      },
    })),
}));
