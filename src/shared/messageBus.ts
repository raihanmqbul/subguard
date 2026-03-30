// ─── Message Types ───────────────────────────────────────────────────────────

import browser from './browser';
import type { Runtime } from 'webextension-polyfill/namespaces/runtime';

export type MessageType =
  | 'SUBSCRIPTION_DETECTED'
  | 'VALIDATE_LICENSE'
  | 'START_EMAIL_SCAN'
  | 'CANCEL_EMAIL_SCAN'
  | 'GET_STATS'
  | 'SCHEDULE_ALARM'
  | 'CANCEL_ALARM'
  | 'REVALIDATE_LICENSE'
  | 'HIGHLIGHT_CANCEL_BUTTON';

// ─── Message Interfaces ──────────────────────────────────────────────────────

export interface Message<T extends MessageType, P = unknown> {
  type: T;
  payload: P;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Payload Types ───────────────────────────────────────────────────────────

export interface SubscriptionDetectedPayload {
  service: string;
  cost?: number;
  currency?: string;
  billingCycle?: string;
  renewalDate?: string;
  detectedFrom: string;
}

export interface ValidateLicensePayload {
  key: string;
}

export interface ScheduleAlarmPayload {
  subscriptionId: string;
  renewalDate: string;
  reminderDaysBefore: number;
}

export interface CancelAlarmPayload {
  subscriptionId: string;
}

export interface HighlightCancelButtonPayload {
  cancelUrl: string;
}

// ─── Typed Message Map ───────────────────────────────────────────────────────

export interface MessagePayloadMap {
  SUBSCRIPTION_DETECTED: SubscriptionDetectedPayload;
  VALIDATE_LICENSE: ValidateLicensePayload;
  START_EMAIL_SCAN: Record<string, never>;
  CANCEL_EMAIL_SCAN: Record<string, never>;
  GET_STATS: Record<string, never>;
  SCHEDULE_ALARM: ScheduleAlarmPayload;
  CANCEL_ALARM: CancelAlarmPayload;
  REVALIDATE_LICENSE: Record<string, never>;
  HIGHLIGHT_CANCEL_BUTTON: HighlightCancelButtonPayload;
}

// ─── sendMessage ─────────────────────────────────────────────────────────────

/**
 * Send a typed message to the Service Worker and await a typed response.
 * Rejects if chrome.runtime.lastError is set.
 */
export function sendMessage<T extends MessageType>(
  type: T,
  payload: MessagePayloadMap[T]
): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    const message: Message<T, MessagePayloadMap[T]> = { type, payload };
    browser.runtime.sendMessage(message).then((response: unknown) => {
      resolve((response as MessageResponse) ?? { success: false, error: 'No response received' });
    }).catch((err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

// ─── onMessage ───────────────────────────────────────────────────────────────

export type MessageHandler<T extends MessageType> = (
  payload: MessagePayloadMap[T],
  sender: Runtime.MessageSender
) => Promise<MessageResponse> | MessageResponse;

/**
 * Register a handler for a specific message type.
 * Returns an unsubscribe function.
 */
export function onMessage<T extends MessageType>(
  type: T,
  handler: MessageHandler<T>
): () => void {
  const listener = (
    message: unknown,
    sender: Runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): true => {
    const msg = message as Message<MessageType, unknown>;
    if (msg.type !== type) return true;

    const result = handler(msg.payload as MessagePayloadMap[T], sender);

    if (result instanceof Promise) {
      result
        .then(sendResponse)
        .catch((err: unknown) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      // Return true to keep the message channel open for async response
      return true;
    }

    sendResponse(result);
    return true;
  };

  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
