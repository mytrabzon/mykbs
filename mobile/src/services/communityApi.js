/**
 * Topluluk ve bildirim API - Supabase Edge Functions.
 * getSupabaseToken() ile alınan JWT kullanılır (backend login sonrası supabase_access_token dönebilir).
 */
import { callFn, EdgeFunctionError } from '../lib/supabase/functions';

export async function getMe(supabaseToken) {
  return callFn('me', {}, supabaseToken);
}

export async function getCommunityPosts(options = {}, supabaseToken) {
  const { branch_id, type, category, limit = 20, offset = 0 } = options;
  return callFn('community_post_list', {
    branch_id,
    type,
    category,
    limit,
    offset,
  }, supabaseToken);
}

export async function createPost(body, supabaseToken) {
  return callFn('community_post_create', body, supabaseToken);
}

export async function addComment(postId, body, supabaseToken) {
  return callFn('community_post_comment', { post_id: postId, body }, supabaseToken);
}

export async function toggleReaction(postId, liked, supabaseToken) {
  return callFn('community_post_react', {
    post_id: postId,
    action: liked ? 'unlike' : 'like',
  }, supabaseToken);
}

export async function deletePost(postId, supabaseToken) {
  return callFn('community_post_delete', { post_id: postId }, supabaseToken);
}

export async function createAnnouncement(body, supabaseToken) {
  return callFn('community_announcement_create', body, supabaseToken);
}

export async function getInAppNotifications(options = {}, supabaseToken) {
  const { limit = 50, offset = 0, unread_only } = options;
  return callFn('in_app_notifications_list', {
    limit,
    offset,
    unread_only,
  }, supabaseToken);
}

export async function markNotificationRead(notificationId, supabaseToken) {
  return callFn('in_app_notifications_mark_read', { notification_id: notificationId }, supabaseToken);
}

export async function markAllNotificationsRead(supabaseToken) {
  return callFn('in_app_notifications_mark_read', { all: true }, supabaseToken);
}

export async function registerPushToken(token, platform, supabaseToken) {
  return callFn('push_register_token', { token, platform }, supabaseToken);
}

export { EdgeFunctionError };
