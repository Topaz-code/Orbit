import { useEffect, useRef } from 'react';
import { subscribe } from '@/lib/mqtt';

/**
 * Subscribes to an MQTT topic for the lifetime of the component.
 * The handler is kept in a ref so callers don't need to memoise it.
 */
export function useMqttSubscription(
  topic: string | null | undefined,
  handler: (payload: any, topic: string) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!topic || !enabled) return;
    return subscribe(topic, (payload, receivedTopic) => handlerRef.current(payload, receivedTopic));
  }, [topic, enabled]);
}
