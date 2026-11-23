/**
 * Image server client — CommonJS port of the reference module in the private
 * docs (docs/image-server.md §5). Server-side ONLY: the project key never
 * reaches the browser, and the presigned PUT carries NO key (STR/08 §15).
 *
 * Lifecycle rules (docs §6): presign fresh per upload (30-min expiry, never
 * persist uploadUrl); register + replace are idempotent; move/rename never
 * change the URL so no DB update is needed; entities keep {id, url} pairs.
 */
import type { ImageServerConfig } from '@liars-game/shared/server';
import type { FetchLike } from './oauth.js';

export class ImageServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The service's own human-readable error text (never contains our key). */
    readonly serviceMessage?: string,
  ) {
    super(message);
    this.name = 'ImageServerError';
  }
}

export interface UploadOptions {
  /** 1–3 segments, each 1–60 chars [a-z0-9-] (docs §7). */
  folder?: string;
}

export interface UploadedImage {
  id: string;
  name: string;
  folder?: string;
  /** Absolute public URL — IMAGE_SERVER_URL + the service's relative publicUrl. */
  url: string;
}

interface PresignUpload {
  uploadUrl: string;
  key: string;
  slug: string;
  folder?: string;
  headers: Record<string, string>;
  expiresIn: number;
}

interface FileDto {
  id: string;
  name: string;
  slug?: string;
  folder?: string;
  contentType?: string;
  size?: number;
  publicUrl: string;
  createdAt?: string;
}

export interface ListImagesResult {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  files: FileDto[];
}

export interface ImageClient {
  /** Resolves + caches the project id. Ours is already in env — the
   * master-key project endpoints are never called by this app. */
  ensureProject(): Promise<string>;
  presign(
    buffer: Buffer,
    filename: string,
    contentType: string,
    folder?: string,
  ): Promise<{ projectId: string; upload: PresignUpload }>;
  uploadImage(
    buffer: Buffer,
    filename: string,
    contentType: string,
    opts?: UploadOptions,
  ): Promise<UploadedImage>;
  replaceImage(
    id: string,
    buffer: Buffer,
    filename: string,
    contentType: string,
    opts?: UploadOptions,
  ): Promise<UploadedImage>;
  renameImage(id: string, name: string): Promise<FileDto>;
  moveImage(id: string, folder?: string): Promise<FileDto>;
  deleteImage(id: string): Promise<{ deleted: boolean }>;
  listImages(page?: number): Promise<ListImagesResult>;
}

/** Pure folder validation (docs §7): 1–3 segments of [a-z0-9-], 1–60 chars. */
export function validateFolder(
  folder: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const segments = folder.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return { ok: false, error: 'folder must not be empty' };
  if (segments.length > 3) return { ok: false, error: 'folder must be 1–3 segments' };
  for (const segment of segments) {
    if (segment.length > 60 || !/^[a-z0-9-]+$/.test(segment)) {
      return { ok: false, error: `invalid folder segment "${segment}" (a-z, 0-9, dashes; 1–60 chars)` };
    }
  }
  return { ok: true, value: segments.join('/') };
}

/** Slugifies an upload filename (spaces auto-dash, lowercase ascii only). */
export function slugifyFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 100);
  return slug.length > 0 ? slug : 'upload';
}

export function createImageServerClient(
  config: ImageServerConfig,
  deps: { fetch?: FetchLike } = {},
): ImageClient {
  const base = config.url.replace(/\/+$/, '');
  const doFetch = deps.fetch ?? globalThis.fetch;
  let cachedProjectId: string | null = config.projectId;

  async function api<T extends Record<string, unknown>>(
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': config.key },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* empty error body */
    }
    if (!res.ok) {
      const serviceMessage =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : undefined;
      // 401 = project key wrong/revoked — surfaced loudly, never swallowed.
      throw new ImageServerError(
        `image server ${method} ${path} failed (${res.status})${serviceMessage ? `: ${serviceMessage}` : ''}`,
        res.status,
        serviceMessage,
      );
    }
    return (data ?? {}) as T;
  }

  async function ensureProject(): Promise<string> {
    if (cachedProjectId) return cachedProjectId;
    // Our env always carries IMAGE_SERVER_PROJECT_ID (shared config enforces
    // it); reaching the master-key bootstrap endpoints from app code is
    // prohibited, so this is a config error.
    throw new ImageServerError('image server project id not configured (env IMAGE_SERVER_PROJECT_ID)', 500);
  }

  async function presign(
    buffer: Buffer,
    filename: string,
    contentType: string,
    folder?: string,
  ): Promise<{ projectId: string; upload: PresignUpload }> {
    const projectId = await ensureProject();
    const response = await api<{ upload?: PresignUpload }>('/api/files/presign', 'POST', {
      projectId,
      filename,
      contentType,
      size: buffer.length,
      ...(folder ? { folder } : {}),
    });
    const upload = response.upload;
    if (!upload || typeof upload.uploadUrl !== 'string' || !upload.key) {
      throw new ImageServerError('image server presign response missing upload details', 502);
    }
    return { projectId, upload };
  }

  return {
    ensureProject,

    presign,

    async uploadImage(
      buffer: Buffer,
      filename: string,
      contentType: string,
      opts: UploadOptions = {},
    ): Promise<UploadedImage> {
      const { projectId, upload } = await presign(buffer, filename, contentType, opts.folder);
      // Direct PUT — EXACT presigned headers, NO api key on this call.
      const put = await doFetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers,
        body: buffer,
      });
      if (!put.ok) {
        throw new ImageServerError(`direct upload failed (${put.status})`, put.status);
      }
      const registered = await api<{ file?: FileDto }>('/api/files', 'POST', {
        projectId,
        key: upload.key,
        name: filename,
      });
      const file = registered.file;
      if (!file || typeof file.id !== 'string' || typeof file.publicUrl !== 'string') {
        throw new ImageServerError('image server register response missing file', 502);
      }
      return {
        id: file.id,
        name: file.name ?? filename,
        folder: file.folder,
        url: `${base}${file.publicUrl}`,
      };
    },

    async replaceImage(
      id: string,
      buffer: Buffer,
      filename: string,
      contentType: string,
      opts: UploadOptions = {},
    ): Promise<UploadedImage> {
      const { projectId, upload } = await presign(buffer, filename, contentType, opts.folder);
      const replaced = await api<{ file?: FileDto }>(
        `/api/files/${encodeURIComponent(id)}/replace`,
        'POST',
        { key: upload.key, name: filename },
      );
      const file = replaced.file;
      if (!file || typeof file.id !== 'string' || typeof file.publicUrl !== 'string') {
        throw new ImageServerError('image server replace response missing file', 502);
      }
      return {
        id: file.id,
        name: file.name ?? filename,
        folder: file.folder,
        url: `${base}${file.publicUrl}`,
      };
    },

    async renameImage(id: string, name: string): Promise<FileDto> {
      const { file } = await api<{ file?: FileDto }>(
        `/api/files/${encodeURIComponent(id)}`,
        'PATCH',
        { name },
      );
      if (!file) throw new ImageServerError('image server rename response missing file', 502);
      return file;
    },

    async moveImage(id: string, folder = ''): Promise<FileDto> {
      const { file } = await api<{ file?: FileDto }>(
        `/api/files/${encodeURIComponent(id)}`,
        'PATCH',
        { folder },
      );
      if (!file) throw new ImageServerError('image server move response missing file', 502);
      return file;
    },

    async deleteImage(id: string): Promise<{ deleted: boolean }> {
      const result = await api<{ deleted?: boolean }>(
        `/api/files/${encodeURIComponent(id)}`,
        'DELETE',
      );
      return { deleted: result.deleted !== false };
    },

    async listImages(page = 1): Promise<ListImagesResult> {
      const projectId = await ensureProject();
      const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
      const data = await api<{
        page?: number;
        perPage?: number;
        total?: number;
        totalPages?: number;
        files?: FileDto[];
      }>(`/api/projects/${encodeURIComponent(projectId)}/files?page=${safePage}`, 'GET');
      return {
        page: data.page ?? safePage,
        perPage: data.perPage ?? 20,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 0,
        files: data.files ?? [],
      };
    },
  };
}
