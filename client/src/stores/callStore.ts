import { create } from 'zustand';
import type { IncomingCallPayload, PostAuthor } from '@/types';

export type CallPhase = 'idle' | 'ringing' | 'incoming' | 'connecting' | 'active' | 'ended';

interface CallState {
  phase: CallPhase;
  callId: string | null;
  type: 'voice' | 'video';
  peer: PostAuthor | null;
  peerId: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  startedAt: number | null;
  endedDuration: number;
  error: string | null;

  startOutgoing: (payload: { callId: string; type: 'voice' | 'video'; peer: PostAuthor; peerId: string }) => void;
  receiveIncoming: (payload: IncomingCallPayload) => void;
  setPhase: (phase: CallPhase) => void;
  markActive: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initial = {
  phase: 'idle' as CallPhase,
  callId: null,
  type: 'voice' as const,
  peer: null,
  peerId: null,
  isMuted: false,
  isCameraOff: false,
  startedAt: null,
  endedDuration: 0,
  error: null,
};

export const useCallStore = create<CallState>((set, get) => ({
  ...initial,

  startOutgoing: ({ callId, type, peer, peerId }) =>
    set({ ...initial, phase: 'ringing', callId, type, peer, peerId }),

  receiveIncoming: (payload) =>
    set({
      ...initial,
      phase: 'incoming',
      callId: payload.callId,
      type: payload.type,
      peer: payload.caller,
      peerId: payload.peerId,
    }),

  setPhase: (phase) => set({ phase }),

  markActive: () => set({ phase: 'active', startedAt: Date.now() }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),
  setError: (error) => set({ error }),

  reset: () => {
    const { startedAt } = get();
    const endedDuration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    set({ ...initial, phase: endedDuration > 0 ? 'ended' : 'idle', endedDuration });
  },
}));
