import Peer, { type MediaConnection } from 'peerjs';
import { ICE_SERVERS } from './constants';

/**
 * PeerJS singleton.
 *
 * Signalling runs through the PeerJS server embedded in the Orbit backend (`/peerjs` on the same
 * origin), so no third-party service is involved. Google's public STUN servers are used purely
 * for NAT traversal — no media is ever relayed through them.
 */
let peer: Peer | null = null;
let peerIdInUse: string | null = null;

/** PeerJS ids must be deterministic so a caller knows the callee's address. */
export function peerIdFor(userId: string): string {
  return `orbit-${userId.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function getPeer(): Peer | null {
  return peer;
}

export function initPeer(userId: string): Promise<Peer> {
  const id = peerIdFor(userId);
  if (peer && peerIdInUse === id && !peer.destroyed && !peer.disconnected) {
    return Promise.resolve(peer);
  }
  destroyPeer();

  const isSecure = window.location.protocol === 'https:';
  const instance = new Peer(id, {
    host: window.location.hostname,
    port: Number(window.location.port) || (isSecure ? 443 : 80),
    path: '/peerjs',
    secure: isSecure,
    config: { iceServers: ICE_SERVERS },
    debug: 0,
  });

  peer = instance;
  peerIdInUse = id;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Could not reach the call server')), 12000);

    instance.once('open', () => {
      clearTimeout(timer);
      resolve(instance);
    });
    instance.once('error', (error) => {
      clearTimeout(timer);
      // An "unavailable-id" simply means a stale registration; PeerJS reconnects on its own.
      if ((error as Error & { type?: string }).type === 'unavailable-id') {
        resolve(instance);
        return;
      }
      reject(error);
    });
  });
}

export function destroyPeer(): void {
  if (peer) {
    peer.removeAllListeners();
    if (!peer.destroyed) peer.destroy();
  }
  peer = null;
  peerIdInUse = null;
}

export async function getLocalStream(video: boolean): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot access the camera or microphone');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
  });
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export type { MediaConnection };
