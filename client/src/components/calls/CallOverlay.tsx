import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { callDuration, cn } from '@/lib/utils';
import { useCallEngine } from '@/hooks/useCall';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

/**
 * The single, always-mounted call surface. It renders nothing while idle, a ring card while a call
 * is being placed or received, and the full call stage once media is flowing.
 */
export function CallOverlay() {
  const {
    phase,
    type,
    peer,
    isMuted,
    isCameraOff,
    startedAt,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    onStream,
  } = useCallEngine();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Attach media streams to the elements as they arrive.
  useEffect(() => {
    const unsubscribe = onStream((stream, kind) => {
      if (kind === 'local' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (kind === 'remote') {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [onStream, phase]);

  useEffect(() => {
    if (phase !== 'active' || !startedAt) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase, startedAt]);

  if (phase === 'idle' || phase === 'ended' || !peer) return null;

  const isVideo = type === 'video';
  const ringing = phase === 'ringing' || phase === 'incoming' || phase === 'connecting';

  const statusLabel =
    phase === 'incoming'
      ? `Incoming ${isVideo ? 'video' : 'voice'} call`
      : phase === 'ringing'
        ? 'Ringing…'
        : phase === 'connecting'
          ? 'Connecting…'
          : callDuration(elapsed);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white animate-fade-in">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {isVideo && phase === 'active' ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full bg-black object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'absolute bottom-4 right-4 h-40 w-28 rounded-xl border-2 border-white/20 object-cover shadow-2xl sm:h-48 sm:w-36',
                isCameraOff && 'hidden',
              )}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="relative">
              {ringing ? (
                <>
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#6366f1]/40" />
                  <span
                    className="absolute inset-0 animate-pulse-ring rounded-full bg-[#8b5cf6]/30"
                    style={{ animationDelay: '400ms' }}
                  />
                </>
              ) : null}
              <UserAvatar user={peer} size="3xl" className="relative ring-4 ring-white/15" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold">{peer.displayName}</h2>
              <p className="text-sm text-white/70">{statusLabel}</p>
              {peer.username ? <p className="text-xs text-white/40">@{peer.username}</p> : null}
            </div>

            {/* Keeps the local mic/camera alive even when the stage shows an avatar. */}
            <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
          </div>
        )}

        {isVideo && phase === 'active' ? (
          <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">
            <p className="text-sm font-medium">{peer.displayName}</p>
            <p className="text-[11px] text-white/70">{statusLabel}</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/40 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        {phase === 'incoming' ? (
          <>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full bg-destructive p-0 hover:bg-destructive/90"
              onClick={() => void rejectCall()}
              aria-label="Decline call"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              className="h-14 w-14 animate-bounce rounded-full bg-[#22c55e] p-0 hover:bg-[#16a34a]"
              onClick={() => void acceptCall()}
              aria-label="Answer call"
            >
              <Phone className="h-6 w-6" />
            </Button>
          </>
        ) : (
          <>
            <ControlButton
              active={isMuted}
              onClick={toggleMute}
              label={isMuted ? 'Unmute' : 'Mute'}
              icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            />

            {isVideo ? (
              <ControlButton
                active={isCameraOff}
                onClick={toggleCamera}
                label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                icon={isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              />
            ) : null}

            <Button
              size="lg"
              className="h-14 w-14 rounded-full bg-destructive p-0 hover:bg-destructive/90"
              onClick={() => void endCall()}
              aria-label="End call"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid h-12 w-12 place-items-center rounded-full transition-colors',
        active ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25',
      )}
    >
      {icon}
    </button>
  );
}
