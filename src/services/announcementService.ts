import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Announcement, ChatMessage } from '../types';

/**
 * Fetch all company-wide announcements
 */
export const fetchAnnouncements = async (): Promise<Announcement[]> => {
  if (!isSupabaseConfigured) return getMockAnnouncements();

  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching announcements, using fallback:', error.message);
      return getMockAnnouncements();
    }

    return (data || []).map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      author_id: a.author_id,
      author_name: a.author_name || 'System Manager',
      author_avatar: a.author_avatar,
      attachment_url: a.attachment_url,
      attachment_name: a.attachment_name,
      created_at: a.created_at,
    }));
  } catch (err) {
    console.error('Failed to fetch announcements:', err);
    return getMockAnnouncements();
  }
};

/**
 * Create a new company-wide broadcast announcement
 */
export const createAnnouncement = async (
  title: string,
  content: string,
  authorId: string,
  authorName: string,
  authorAvatar?: string,
  attachmentUrl?: string,
  attachmentName?: string
): Promise<Announcement | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert([
        {
          title,
          content,
          author_id: authorId,
          author_name: authorName,
          author_avatar: authorAvatar,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as Announcement;
  } catch (err) {
    console.error('Error creating announcement:', err);
    return null;
  }
};

/**
 * Fetch chat messages for a specific channel ('broadcast', 'team-{id}', etc.)
 */
export const fetchChannelMessages = async (channelId: string): Promise<ChatMessage[]> => {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as ChatMessage[];
  } catch (err) {
    console.error(`Error fetching channel ${channelId} messages:`, err);
    return [];
  }
};

/**
 * Send a message in a channel (with optional file attachment)
 */
export const sendChannelMessage = async (
  channelId: string,
  senderId: string,
  senderName: string,
  senderAvatar: string | undefined,
  content: string,
  attachmentUrl?: string,
  attachmentName?: string,
  attachmentType?: string
): Promise<ChatMessage | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          channel_id: channelId,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar: senderAvatar,
          content,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as ChatMessage;
  } catch (err) {
    console.error('Error sending message:', err);
    return null;
  }
};

// Fallback Mock Data for demo mode
const getMockAnnouncements = (): Announcement[] => [
  {
    id: 'ann-1',
    title: '5G Telecom Hardware Prototype Release - Target Date Locked',
    content: 'The WSS Division has locked the final PCB layout for the 5G Outdoor Unit. All team leads please review your task dependencies.',
    author_name: 'Jignesh Giri (WSS Department Manager)',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    attachment_name: '5G_Outdoor_Unit_Spec_v2.pdf',
    attachment_url: '#',
  },
  {
    id: 'ann-2',
    title: 'QA Environmental Testing Lab Schedule Update',
    content: 'EMI/EMC Testing Chamber B is open for hardware qualification testing from 09:00 AM tomorrow.',
    author_name: 'QA & Compliance Lead',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];
