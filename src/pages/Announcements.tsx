import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import {
  Megaphone,
  MessageSquare,
  Send,
  Paperclip,
  FileText,
  FileSpreadsheet,
  Download,
  Users,
  Plus,
  Shield,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Announcement, ChatMessage } from '../types';
import {
  fetchAnnouncements,
  createAnnouncement,
  fetchChannelMessages,
  sendChannelMessage,
} from '../services/announcementService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Announcements: React.FC = () => {
  const { user, profile, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'broadcast' | 'teams'>('broadcast');
  const [selectedChannel, setSelectedChannel] = useState<string>('general');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // New Announcement Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annFile, setAnnFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isManagerOrAdmin = userRole === 'Admin' || userRole === 'Manager';

  const loadAnnouncementsData = async () => {
    const list = await fetchAnnouncements();
    setAnnouncements(list);
  };

  const loadMessagesData = async (channel: string) => {
    const list = await fetchChannelMessages(channel);
    setMessages(list);
  };

  useEffect(() => {
    loadAnnouncementsData();
    loadMessagesData(selectedChannel);

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('realtime_announcements_chat')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcements' },
          () => {
            loadAnnouncementsData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          (payload) => {
            if (payload.new && (payload.new as any).channel_id === selectedChannel) {
              setMessages((prev) => [...prev, payload.new as ChatMessage]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim() || !user) return;

    setIsSubmitting(true);
    let attachmentUrl = '';
    let attachmentName = '';

    if (annFile && isSupabaseConfigured) {
      try {
        const fileExt = annFile.name.split('.').pop();
        const filePath = `announcements/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data, error } = await supabase.storage.from('task-attachments').upload(filePath, annFile);
        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
          attachmentUrl = publicUrlData.publicUrl;
          attachmentName = annFile.name;
        }
      } catch (err) {
        console.warn('File storage fallback:', err);
      }
    }

    const created = await createAnnouncement(
      annTitle,
      annContent,
      user.id,
      profile?.full_name || user.email || 'Manager',
      profile?.avatar_url,
      attachmentUrl || (annFile ? '#' : undefined),
      attachmentName || annFile?.name
    );

    if (created) {
      setAnnouncements((prev) => [created, ...prev]);
    }

    setAnnTitle('');
    setAnnContent('');
    setAnnFile(null);
    setIsSubmitting(false);
    setShowCreateModal(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const content = newMessage.trim();
    setNewMessage('');

    const sent = await sendChannelMessage(
      selectedChannel,
      user.id,
      profile?.full_name || user.email || 'Member',
      profile?.avatar_url,
      content
    );

    if (sent) {
      setMessages((prev) => [...prev, sent]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
              HFCL Communications
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">Live Workspace Hub</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Megaphone className="w-6 h-6 text-brand-600" />
            Company Announcements & Team Channels
          </h1>
        </div>

        {isManagerOrAdmin && (
          <Button
            variant="primary"
            size="md"
            className="shadow-soft font-semibold text-xs"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Post Announcement
          </Button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'broadcast'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Company Broadcasts (100 Employees)
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Team Group Channels
        </button>
      </div>

      {/* Broadcast Tab View */}
      {activeTab === 'broadcast' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Announcements Yet</h3>
              <p className="text-xs text-slate-500 mt-1">Company-wide broadcasts posted by Managers will appear here.</p>
            </Card>
          ) : (
            announcements.map((item) => (
              <Card key={item.id} hoverEffect className="p-5 border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={item.author_name} src={item.author_avatar} size="md" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{item.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-700">{item.author_name}</span>
                        <span>•</span>
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="primary" dot>
                    Official Notice
                  </Badge>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line pt-1">{item.content}</p>

                {item.attachment_name && (
                  <div className="pt-2">
                    <a
                      href={item.attachment_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-brand-600" />
                      <span>{item.attachment_name}</span>
                      <Download className="w-3.5 h-3.5 ml-1 text-slate-400" />
                    </a>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Team Channels Chat View */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[600px] border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-soft">
          {/* Channel Selector List */}
          <div className="border-r border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">Team Channels</h4>
            <div className="space-y-1">
              {[
                { id: 'general', name: '# general-discussions' },
                { id: 'hardware', name: '# hardware-team' },
                { id: 'mechanical', name: '# mechanical-team' },
                { id: 'embedded', name: '# embedded-firmware' },
                { id: 'qa', name: '# qa-compliance' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedChannel === ch.id
                      ? 'bg-brand-600 text-white shadow-soft-xs'
                      : 'text-slate-700 hover:bg-slate-200/60'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Panel */}
          <div className="md:col-span-3 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-bold text-slate-900 uppercase">
                  Channel: #{selectedChannel}
                </span>
              </div>
              <Badge variant="neutral">Live WebSocket Sync</Badge>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-xs">
                  No messages in #{selectedChannel} yet. Start the conversation!
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <Avatar name={m.sender_name} src={m.sender_avatar} size="sm" />
                      <div>
                        <div className={`flex items-center gap-2 mb-1 text-[11px] text-slate-400 ${isMe ? 'justify-end' : ''}`}>
                          <span className="font-bold text-slate-700">{m.sender_name}</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-brand-600 text-white rounded-tr-none'
                              : 'bg-slate-100 text-slate-800 rounded-tl-none'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2 bg-slate-50/30">
              <Input
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                placeholder={`Message #${selectedChannel}...`}
                className="text-xs flex-1"
              />
              <Button type="submit" variant="primary" size="md" leftIcon={<Send className="w-4 h-4" />}>
                Send
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Post Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-600" />
                Broadcast Announcement to 100 Employees
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Title</label>
                <Input
                  required
                  value={annTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnnTitle(e.target.value)}
                  placeholder="e.g. Prototype Release Milestone Lock"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Announcement Message</label>
                <textarea
                  required
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Write message for all employees..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Attach File (PDF, Excel, Word)
                </label>
                <input
                  type="file"
                  onChange={(e) => setAnnFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                  Post Broadcast
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
