import { supabase } from './supabase';

/**
 * Attachment storage — private bucket `task-attachments`, path layout:
 *   <projectId>/<taskId|general>/<sanitizedFilename>
 *
 * Access is enforced by storage RLS (20260811005630_phase2_private_attachments.sql):
 * project creators/members and admins only. Files are served via 15-minute
 * signed URLs — never baked into task/announcement rows as public links.
 */

const BUCKET = 'task-attachments';
const SIGNED_URL_TTL_SECONDS = 15 * 60;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/** Upload a file under the project/task scope. Returns the storage path. */
export async function uploadAttachment(
  projectId: string,
  taskId: string | null,
  file: File
): Promise<{ path: string | null; error: Error | null }> {
  const scope = taskId ?? 'general';
  const path = `${projectId}/${scope}/${Date.now()}_${sanitizeFilename(file.name)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) return { path: null, error };
  return { path, error: null };
}

/** Generate a short-lived signed URL for a stored attachment path. */
export async function getAttachmentUrl(
  path: string
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return { url: null, error: error ?? new Error('Failed to sign URL') };
  }
  return { url: data.signedUrl, error: null };
}

/**
 * Resolve a displayable/downloadable URL for an attachment reference.
 * Accepts either a storage path (new) or a legacy full URL (old public
 * bucket); legacy URLs are passed through unchanged for backward compat.
 */
export async function resolveAttachmentUrl(ref: string): Promise<string> {
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
  const { url } = await getAttachmentUrl(ref);
  return url ?? ref;
}
