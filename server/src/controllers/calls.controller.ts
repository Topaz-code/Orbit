import type { Request, Response } from 'express';
import type { z } from 'zod';
import { prisma } from '../config/database.js';
import { TOPICS, publish } from '../config/mqtt.js';
import { isUserOnline } from '../services/presence.service.js';
import { currentUser } from '../middleware/auth.middleware.js';
import { forbidden, notFound } from '../utils/errors.js';
import { parseLimit } from '../utils/helpers.js';
import { createNotification } from '../services/notifications.service.js';
import type { createCallSchema, updateCallSchema } from '../validators/index.js';

const callInclude = {
  caller: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  receiver: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

interface CallRecord {
  id: string;
  callerId: string;
  receiverId: string;
  conversationId: string | null;
  type: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  caller: { id: string; username: string; displayName: string; avatarUrl: string };
  receiver: { id: string; username: string; displayName: string; avatarUrl: string };
}

function serializeCall(call: CallRecord, viewerId: string) {
  const isOutgoing = call.callerId === viewerId;
  const durationSeconds = call.endedAt
    ? Math.max(0, Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000))
    : 0;

  return {
    id: call.id,
    type: call.type,
    status: call.status,
    direction: isOutgoing ? 'outgoing' : 'incoming',
    peer: isOutgoing ? call.receiver : call.caller,
    caller: call.caller,
    receiver: call.receiver,
    conversationId: call.conversationId,
    startedAt: call.startedAt.toISOString(),
    endedAt: call.endedAt?.toISOString() ?? null,
    durationSeconds,
    isMissed: call.status === 'missed' || (call.status === 'rejected' && !isOutgoing),
  };
}

export async function listHistory(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const calls = await prisma.call.findMany({
    where: { OR: [{ callerId: user.id }, { receiverId: user.id }] },
    include: callInclude,
    orderBy: { startedAt: 'desc' },
    take: parseLimit(req.query.limit, 40, 100),
  });

  res.json({ items: calls.map((call) => serializeCall(call as CallRecord, user.id)) });
}

/**
 * POST /api/calls — records the call and rings the receiver over MQTT.
 * The actual audio/video runs peer-to-peer over WebRTC (PeerJS); this endpoint only handles
 * bookkeeping and signalling, so no media ever touches the server.
 */
export async function startCall(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof createCallSchema>;

  const receiver = await prisma.user.findUnique({
    where: { id: body.receiverId },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  if (!receiver) throw notFound('That person does not exist');

  const call = await prisma.call.create({
    data: {
      callerId: user.id,
      receiverId: receiver.id,
      conversationId: body.conversationId ?? null,
      type: body.type,
      status: 'ringing',
    },
    include: callInclude,
  });

  publish(TOPICS.callIncoming(receiver.id), {
    event: 'incoming_call',
    callId: call.id,
    type: call.type,
    conversationId: call.conversationId,
    // PeerJS ids are derived from the user id so the callee knows who to answer.
    peerId: `orbit-${user.id}`,
    caller: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
    startedAt: call.startedAt.toISOString(),
  });

  res.status(201).json({
    call: serializeCall(call as CallRecord, user.id),
    receiverOnline: isUserOnline(receiver.id),
    peerId: `orbit-${receiver.id}`,
  });
}

export async function updateCall(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof updateCallSchema>;
  const callId = req.params.id as string;

  const existing = await prisma.call.findUnique({ where: { id: callId }, include: callInclude });
  if (!existing) throw notFound('That call no longer exists');
  if (existing.callerId !== user.id && existing.receiverId !== user.id) {
    throw forbidden('That call is not yours');
  }

  const isTerminal = ['ended', 'missed', 'rejected'].includes(body.status);
  const call = await prisma.call.update({
    where: { id: callId },
    data: {
      status: body.status,
      ...(isTerminal ? { endedAt: new Date() } : {}),
    },
    include: callInclude,
  });

  const otherId = existing.callerId === user.id ? existing.receiverId : existing.callerId;
  publish(TOPICS.callSignal(callId), {
    event: 'call_status',
    callId,
    status: body.status,
    by: user.id,
  });
  publish(TOPICS.callIncoming(otherId), {
    event: 'call_status',
    callId,
    status: body.status,
    by: user.id,
  });

  if ((body.status === 'missed' || body.status === 'rejected') && existing.callerId !== user.id) {
    await createNotification({
      userId: existing.callerId,
      actorId: user.id,
      type: 'missed_call',
      content:
        body.status === 'missed'
          ? `${user.displayName} missed your ${existing.type} call`
          : `${user.displayName} declined your ${existing.type} call`,
      referenceId: callId,
      referenceType: 'call',
    });
  }
  if (body.status === 'missed' && existing.callerId === user.id) {
    await createNotification({
      userId: existing.receiverId,
      actorId: user.id,
      type: 'missed_call',
      content: `You missed a ${existing.type} call from ${user.displayName}`,
      referenceId: callId,
      referenceType: 'call',
    });
  }

  res.json({ call: serializeCall(call as CallRecord, user.id) });
}

export async function getCall(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const call = await prisma.call.findUnique({
    where: { id: req.params.id as string },
    include: callInclude,
  });
  if (!call) throw notFound('That call no longer exists');
  if (call.callerId !== user.id && call.receiverId !== user.id) {
    throw forbidden('That call is not yours');
  }
  res.json({ call: serializeCall(call as CallRecord, user.id) });
}
