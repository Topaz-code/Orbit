import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaConnection } from 'peerjs';
import { api, apiErrorMessage } from '@/lib/api';
import { destroyPeer, getLocalStream, initPeer, peerIdFor, stopStream } from '@/lib/peer';
import { topics } from '@/lib/mqtt';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { toast } from '@/stores/notificationStore';
import { useMqttSubscription } from './useMQTT';
import type { Call, IncomingCallPayload, PostAuthor } from '@/types';

export const callKeys = { history: ['calls', 'history'] as const };

export function useCallHistory() {
  return useQuery({
    queryKey: callKeys.history,
    queryFn: async () => {
      const response = await api.get<{ items: Call[] }>('/calls/history');
      return response.data.items;
    },
  });
}

/**
 * Owns the full WebRTC lifecycle: media capture, PeerJS connection, and the MQTT signalling that
 * rings/accepts/rejects a call. Mounted once at the app shell.
 */
export function useCallEngine() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const store = useCallStore();

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<MediaConnection | null>(null);
  const pendingConnection = useRef<MediaConnection | null>(null);
  const listenersRef = useRef<Set<(stream: MediaStream | null, kind: 'local' | 'remote') => void>>(new Set());

  const emitStream = useCallback((stream: MediaStream | null, kind: 'local' | 'remote') => {
    for (const listener of listenersRef.current) listener(stream, kind);
  }, []);

  const onStream = useCallback(
    (listener: (stream: MediaStream | null, kind: 'local' | 'remote') => void) => {
      listenersRef.current.add(listener);
      if (localStreamRef.current) listener(localStreamRef.current, 'local');
      if (remoteStreamRef.current) listener(remoteStreamRef.current, 'remote');
      return () => listenersRef.current.delete(listener);
    },
    [],
  );

  const teardown = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    emitStream(null, 'local');
    emitStream(null, 'remote');
  }, [emitStream]);

  const updateStatus = useCallback(
    async (callId: string, status: Call['status']) => {
      try {
        await api.put(`/calls/${callId}`, { status });
      } catch {
        /* the call is over either way */
      }
      void queryClient.invalidateQueries({ queryKey: callKeys.history });
    },
    [queryClient],
  );

  const attachConnection = useCallback(
    (connection: MediaConnection) => {
      connectionRef.current = connection;
      connection.on('stream', (remote) => {
        remoteStreamRef.current = remote;
        emitStream(remote, 'remote');
        useCallStore.getState().markActive();
      });
      connection.on('close', () => {
        const { callId } = useCallStore.getState();
        if (callId) void updateStatus(callId, 'ended');
        teardown();
        useCallStore.getState().reset();
      });
      connection.on('error', () => {
        toast.error('Call failed', 'The connection dropped.');
        teardown();
        useCallStore.getState().reset();
      });
    },
    [emitStream, teardown, updateStatus],
  );

  /** Places an outgoing call. */
  const startCall = useCallback(
    async (peerUser: PostAuthor, type: 'voice' | 'video', conversationId?: string | null) => {
      if (!currentUser) return;
      try {
        const response = await api.post<{ call: Call; receiverOnline: boolean; peerId: string }>('/calls', {
          receiverId: peerUser.id,
          type,
          conversationId: conversationId ?? null,
        });
        const { call, receiverOnline } = response.data;

        useCallStore.getState().startOutgoing({
          callId: call.id,
          type,
          peer: peerUser,
          peerId: peerIdFor(peerUser.id),
        });

        if (!receiverOnline) {
          toast.info(`${peerUser.displayName} is offline`, 'They will see a missed call.');
        }

        const stream = await getLocalStream(type === 'video');
        localStreamRef.current = stream;
        emitStream(stream, 'local');

        const peer = await initPeer(currentUser.id);
        const connection = peer.call(peerIdFor(peerUser.id), stream, {
          metadata: { callId: call.id, type, from: currentUser.id },
        });
        attachConnection(connection);

        void queryClient.invalidateQueries({ queryKey: callKeys.history });
      } catch (error) {
        const message = apiErrorMessage(error, 'Could not start the call');
        toast.error('Call failed', message);
        useCallStore.getState().setError(message);
        teardown();
        useCallStore.getState().reset();
      }
    },
    [attachConnection, currentUser, emitStream, queryClient, teardown],
  );

  /** Accepts the ringing call — answers the pending PeerJS connection with our media. */
  const acceptCall = useCallback(async () => {
    const { callId, type } = useCallStore.getState();
    const pending = pendingConnection.current;
    if (!callId) return;

    try {
      useCallStore.getState().setPhase('connecting');
      const stream = await getLocalStream(type === 'video');
      localStreamRef.current = stream;
      emitStream(stream, 'local');

      if (pending) {
        pending.answer(stream);
        attachConnection(pending);
        pendingConnection.current = null;
      }
      await updateStatus(callId, 'ongoing');
      useCallStore.getState().markActive();
    } catch (error) {
      toast.error('Could not answer', apiErrorMessage(error, 'Check your camera and microphone permissions'));
      await updateStatus(callId, 'missed');
      teardown();
      useCallStore.getState().reset();
    }
  }, [attachConnection, emitStream, teardown, updateStatus]);

  const rejectCall = useCallback(async () => {
    const { callId } = useCallStore.getState();
    pendingConnection.current?.close();
    pendingConnection.current = null;
    if (callId) await updateStatus(callId, 'rejected');
    teardown();
    useCallStore.getState().reset();
  }, [teardown, updateStatus]);

  const endCall = useCallback(async () => {
    const { callId, phase } = useCallStore.getState();
    if (callId) {
      await updateStatus(callId, phase === 'active' ? 'ended' : 'missed');
    }
    teardown();
    useCallStore.getState().reset();
  }, [teardown, updateStatus]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !useCallStore.getState().isMuted;
    stream.getAudioTracks().forEach((track) => (track.enabled = !next));
    useCallStore.getState().toggleMute();
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !useCallStore.getState().isCameraOff;
    stream.getVideoTracks().forEach((track) => (track.enabled = !next));
    useCallStore.getState().toggleCamera();
  }, []);

  // Register with the PeerJS server and wait for inbound media connections.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    void initPeer(currentUser.id)
      .then((peer) => {
        if (cancelled) return;
        peer.on('call', (connection) => {
          pendingConnection.current = connection;
          // The ring itself arrives over MQTT (with caller details); if the state machine is idle
          // the call was started before we connected, so surface it anyway.
          if (useCallStore.getState().phase === 'idle') {
            const metadata = connection.metadata as { callId?: string; type?: 'voice' | 'video' } | undefined;
            useCallStore.getState().receiveIncoming({
              event: 'incoming_call',
              callId: metadata?.callId ?? '',
              type: metadata?.type ?? 'voice',
              conversationId: null,
              peerId: connection.peer,
              caller: { id: '', username: '', displayName: 'Someone', avatarUrl: '' },
              startedAt: new Date().toISOString(),
            });
          }
        });
      })
      .catch(() => {
        /* calls are unavailable until the peer server is reachable */
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => () => {
    teardown();
    destroyPeer();
  }, [teardown]);

  // Ring / status updates from the other side.
  useMqttSubscription(
    currentUser ? topics.callIncoming(currentUser.id) : null,
    (payload: IncomingCallPayload & { event: string; status?: Call['status'] }) => {
      if (payload.event === 'incoming_call') {
        if (useCallStore.getState().phase !== 'idle') return; // already busy
        useCallStore.getState().receiveIncoming(payload);
        void queryClient.invalidateQueries({ queryKey: callKeys.history });
        return;
      }
      if (payload.event === 'call_status') {
        const status = payload.status;
        if (status && ['ended', 'rejected', 'missed'].includes(status)) {
          if (status === 'rejected') toast.info('Call declined');
          teardown();
          useCallStore.getState().reset();
          void queryClient.invalidateQueries({ queryKey: callKeys.history });
        }
      }
    },
    Boolean(currentUser),
  );

  return {
    ...store,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    onStream,
  };
}

export function useUpdateCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ callId, status }: { callId: string; status: Call['status'] }) => {
      await api.put(`/calls/${callId}`, { status });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: callKeys.history }),
  });
}
