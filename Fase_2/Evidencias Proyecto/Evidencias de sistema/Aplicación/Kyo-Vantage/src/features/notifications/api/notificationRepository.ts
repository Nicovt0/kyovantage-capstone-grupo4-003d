import { createClient } from '@/utils/supabase/client';
import { Notification, CreateNotificationInput } from '@/types/notification';

export async function getNotifications(): Promise<Notification[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data as Notification[];
}

export async function createNotification(input: CreateNotificationInput): Promise<boolean> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return false;

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userData.user.id,
      type: ['bill_reminder', 'budget_alert', 'credit_card_due', 'system'].includes(input.type) ? input.type : 'system',
      title: input.title,
      message: input.message,
      is_read: false
    });

  if (error) {
    console.error('Error creating notification:', error);
    return false;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications_updated'));
  }

  return true;
}

export async function markAsRead(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications_updated'));
  }

  return true;
}

export async function markAllAsRead(): Promise<boolean> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userData.user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications_updated'));
  }

  return true;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting notification:', error);
    return false;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications_updated'));
  }

  return true;
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userData.user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
}
