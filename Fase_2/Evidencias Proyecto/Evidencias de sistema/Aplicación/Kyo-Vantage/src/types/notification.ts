export type NotificationType = 'security' | 'creation' | 'transaction' | 'alert' | 'system' | 'budget' | 'success';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface SavePushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
}
