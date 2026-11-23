/**
 * Image server client contract tests (docs/image-server.md §3–§7):
 * exact request shapes, presigned PUT carries NO key, fresh presign per
 * upload, register idempotency shapes, folder validation, loud 401s.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createImageServerClient,
  ImageServerError,
  slugifyFileName,
  validateFolder,
  type ImageClient,
} from '../src/lib/imageServer.js';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function jsonHeaders(key: string): Record<string, string> {
  return { 'content-type': 'application/json', 'x-api-key': key };
}

const CONFIG = { url: 'http://images.test', key: 'img-key', projectId: 'prj-1' };

function makeClient(staged: Array<{ status: number; body: unknown }>): {
  client: ImageClient;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url,
      method: String(init?.method ?? 'GET'),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    });
    const next = staged.shift();
    if (!next) throw new Error('no staged response');
    const text = next.body === undefined ? '' : JSON.stringify(next.body);
    return new Response(text, { status: next.status, headers: { 'content-type': 'application/json' } });
  };
  const client = createImageServerClient(CONFIG, { fetchImpl });
  return { client, calls };
}

const BUFFER = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);

describe('validateFolder (docs §7: 1–3 segments, [a-z0-9-], 1–60 chars)', () => {
  it('accepts valid folders including nested ones', () => {
    expect(validateFolder('catalog')).toEqual({ ok: true, value: 'catalog' });
    expect(validateFolder('catalog/hair')).toEqual({ ok: true, value: 'catalog/hair' });
    expect(validateFolder('themes/saloon/hero')).toEqual({ ok: true, value: 'themes/saloon/hero' });
  });

  it('rejects empty / uppercase / illegal chars / 4 segments / long segments', () => {
    for (const bad of ['', 'Bad', 'CATALOG', 'spaced folder', 'a//b', 'a/b/c/d', 'x'.repeat(61)]) {
      expect(validateFolder(bad).ok).toBe(false);
    }
  });
});

describe('slugifyFileName', () => {
  it('slugifies names the way the service expects', () => {
    expect(slugifyFileName('Hero Art.png')).toBe('hero-art.png');
    expect(slugifyFileName('  Weird___Name!!  ')).toBe('weird-name');
    expect(slugifyFileName('Ünicode Êverything')).toBe('nicode-verything');
    expect(slugifyFileName('!!!')).toBe('upload');
  });
});

describe('uploadImage (presign → PUT → register)', () => {
  it('sends the three calls in the exact contract shape', async () => {
    const { client, calls } = makeClient([
      {
        status: 200,
        body: {
          ok: true,
          upload: {
            uploadUrl: 'https://storage.test/signed?sig=abc',
            key: 'catalog/hair/hero-art.png',
            slug: 'hero-art.png',
            folder: 'catalog/hair',
            headers: { 'Content-Type': 'image/png' },
            expiresIn: 1800,
          },
        },
      },
      { status: 200, body: { ok: true } },
      {
        status: 200,
        body: {
          ok: true,
          file: {
            id: 'file_1',
            name: 'hero-art.png',
            folder: 'catalog/hair',
            publicUrl: '/f/file_1/hero-art.png',
          },
        },
      },
    ]);

    const uploaded = await client.uploadImage(BUFFER, 'hero-art.png', 'image/png', {
      folder: 'catalog/hair',
    });

    expect(calls).toHaveLength(3);

    // 1) presign — API key header, exact payload incl. byte size.
    expect(calls[0]?.url).toBe('http://images.test/api/files/presign');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers).toEqual(jsonHeaders('img-key'));
    expect(JSON.parse(String(calls[0]?.body))).toEqual({
      projectId: 'prj-1',
      filename: 'hero-art.png',
      contentType: 'image/png',
      size: BUFFER.length,
      folder: 'catalog/hair',
    });

    // 2) PUT bytes DIRECT to storage — EXACT presigned headers, NO api key.
    expect(calls[1]?.url).toBe('https://storage.test/signed?sig=abc');
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(String(Object.keys(calls[1]?.headers ?? {})).includes('x-api-key')).toBe(false);
    expect(calls[1]?.body).toBe(BUFFER);

    // 3) register {projectId, key, name} — idempotent per key.
    expect(calls[2]?.url).toBe('http://images.test/api/files');
    expect(calls[2]?.headers).toEqual(jsonHeaders('img-key'));
    expect(JSON.parse(String(calls[2]?.body))).toEqual({
      projectId: 'prj-1',
      key: 'catalog/hair/hero-art.png',
      name: 'hero-art.png',
    });

    // Result: {id, url} pair with the ABSOLUTE public URL.
    expect(uploaded).toEqual({
      id: 'file_1',
      name: 'hero-art.png',
      folder: 'catalog/hair',
      url: 'http://images.test/f/file_1/hero-art.png',
    });
  });

  it('presigns FRESH for every upload (30-min expiry — never reuse)', async () => {
    const responses = () => [
      {
        status: 200,
        body: {
          ok: true,
          upload: {
            uploadUrl: `https://storage.test/signed?n=${Math.random() * 1e9}`,
            key: 'a.png',
            headers: { 'Content-Type': 'image/png' },
          },
        },
      },
      { status: 200, body: { ok: true } },
      { status: 200, body: { ok: true, file: { id: `f`, name: 'a.png', publicUrl: '/f/f/a.png' } } },
    ];
    const { client, calls } = makeClient([...responses(), ...responses()]);
    await client.uploadImage(BUFFER, 'a.png', 'image/png');
    await client.uploadImage(BUFFER, 'a.png', 'image/png');
    const presignCalls = calls.filter((c) => c.url.endsWith('/api/files/presign'));
    expect(presignCalls).toHaveLength(2);
  });
});

describe('replaceImage (same id, new url)', () => {
  it('presigns new bytes, PUTs them, then posts to /replace with the fresh key', async () => {
    const { client, calls } = makeClient([
      {
        status: 200,
        body: {
          ok: true,
          upload: { uploadUrl: 'https://storage.test/signed?sig=2', key: 'b.png', headers: { 'Content-Type': 'image/png' } },
        },
      },
      { status: 200, body: { ok: true } },
      {
        status: 200,
        body: {
          ok: true,
          file: { id: 'file_same', name: 'b.png', publicUrl: '/f/file_same/b.png' },
        },
      },
    ]);
    const replaced = await client.replaceImage('file_same', BUFFER, 'b.png', 'image/png');
    expect(replaced).toEqual({ id: 'file_same', name: 'b.png', url: 'http://images.test/f/file_same/b.png' });
    expect(calls[1]?.url).toBe('https://storage.test/signed?sig=2'); // bytes uploaded first
    expect(calls[1]?.headers).toEqual({ 'Content-Type': 'image/png' }); // no api key
    expect(calls[2]?.url).toBe('http://images.test/api/files/file_same/replace');
    expect(JSON.parse(String(calls[2]?.body))).toEqual({ key: 'b.png', name: 'b.png' });
  });
});

describe('rename / move / delete / list', () => {
  it('PATCHes {name} / {folder} (URL never changes) and DELETEs', async () => {
    const { client, calls } = makeClient([
      { status: 200, body: { ok: true, file: { id: 'file_1' } } },
      { status: 200, body: { ok: true, file: { id: 'file_1' } } },
      { status: 200, body: { ok: true, deleted: true } },
    ]);
    await client.renameImage('file_1', 'new-name.png');
    await client.moveImage('file_1', 'misc');
    await client.deleteImage('file_1');
    expect(calls[0]?.url).toBe('http://images.test/api/files/file_1');
    expect(calls[0]?.method).toBe('PATCH');
    expect(JSON.parse(String(calls[0]?.body))).toEqual({ name: 'new-name.png' });
    expect(JSON.parse(String(calls[1]?.body))).toEqual({ folder: 'misc' });
    expect(calls[2]?.method).toBe('DELETE');
  });

  it('moves to root with an empty folder string', async () => {
    const { client, calls } = makeClient([{ status: 200, body: { ok: true, file: { id: 'file_1' } } }]);
    await client.moveImage('file_1');
    expect(JSON.parse(String(calls[0]?.body))).toEqual({ folder: '' });
  });

  it('lists project files, 20 per page, with the API key header', async () => {
    const { client, calls } = makeClient([
      { status: 200, body: { ok: true, page: 2, perPage: 20, total: 21, totalPages: 2, files: [] } },
    ]);
    const list = await client.listImages(2);
    expect(list).toEqual({ page: 2, perPage: 20, total: 21, totalPages: 2, files: [] });
    expect(calls[0]?.url).toBe('http://images.test/api/projects/prj-1/files?page=2');
    expect(calls[0]?.headers['x-api-key']).toBe('img-key');
  });
});

describe('ensureProject + errors', () => {
  it('short-circuits to the configured project id — the master-key bootstrap endpoints are NEVER called', async () => {
    let called = false;
    const fetchImpl = async (): Promise<Response> => {
      called = true;
      throw new Error('must not be called');
    };
    const client = createImageServerClient(CONFIG, { fetchImpl });
    await expect(client.ensureProject()).resolves.toBe('prj-1');
    expect(called).toBe(false);
  });

  it('surfaces 401 loudly with the status (never swallows a key problem)', async () => {
    const { client } = makeClient([{ status: 401, body: { ok: false, error: 'PROJECT_KEY_INVALID' } }]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(client.uploadImage(BUFFER, 'a.png', 'image/png')).rejects.toMatchObject({
      name: 'ImageServerError',
      status: 401,
      serviceMessage: 'PROJECT_KEY_INVALID',
    });
    errorSpy.mockRestore();
  });

  it('is a typed ImageServerError with service detail on 400s', async () => {
    const { client } = makeClient([{ status: 400, body: { ok: false, error: 'folder segment invalid' } }]);
    await expect(client.uploadImage(BUFFER, 'a.png', 'image/png')).rejects.toBeInstanceOf(ImageServerError);
  });

  it('fails fast when the presign response is malformed (502, no register call)', async () => {
    const { client, calls } = makeClient([{ status: 200, body: { ok: true } }]);
    await expect(client.uploadImage(BUFFER, 'a.png', 'image/png')).rejects.toBeInstanceOf(ImageServerError);
    expect(calls).toHaveLength(1);
  });
});
