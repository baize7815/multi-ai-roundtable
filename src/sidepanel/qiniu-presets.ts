// Qiniu-compatible manual expert-preset JSON transfer.
export const CLOUD_PRESET_OBJECT_KEY = 'multi-ai-roundtable/experts.json';
export const CLOUD_PRESET_MAX_BYTES = 5 * 1024 * 1024;
export const CLOUD_CONFIG_STORAGE_KEY = 'multiAiRoundtableQiniuConfigV1';
export const CLOUD_SECRET_SESSION_KEY = 'multiAiRoundtableQiniuSecretV1';
export interface QiniuCloudConfig { endpoint: string; accessKey: string; secretKey: string }
const encoder = new TextEncoder();
const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function parseQiniuEndpoint(input: string): { origin: string; host: string; region: string } {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new Error('七牛 S3 地址无效。'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('请输入完整的 HTTPS S3 存储桶地址，不要添加路径、端口或参数。');
  }
  const match = /^([a-z0-9][a-z0-9-]*)\.s3\.([a-z0-9-]+)\.qiniucs\.com$/i.exec(url.hostname);
  if (!match) throw new Error('地址应为 https://存储桶.s3.区域.qiniucs.com');
  return { origin: url.origin, host: url.host, region: match[2] };
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function sha256(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}
async function hmac(key: string | Uint8Array, content: string): Promise<Uint8Array> {
  const material = typeof key === 'string' ? encoder.encode(key) : key;
  const imported = await crypto.subtle.importKey('raw', material as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(content)));
}
async function signedRequest(method: 'GET' | 'PUT', config: QiniuCloudConfig, body?: Uint8Array): Promise<Response> {
  const { origin, host, region } = parseQiniuEndpoint(config.endpoint);
  const accessKey = config.accessKey.trim();
  const secretKey = config.secretKey.trim();
  if (!accessKey || !secretKey) throw new Error('请填写七牛云 AccessKey 和 SecretKey。');
  if (!/^[A-Za-z0-9_-]+$/.test(accessKey)) throw new Error('AccessKey 格式无效。');
  const uri = '/' + CLOUD_PRESET_OBJECT_KEY.split('/').map(encodeURIComponent).join('/');
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = stamp.slice(0, 8);
  const hash = method === 'PUT' ? await sha256(body ?? new Uint8Array()) : emptyHash;
  const canonicalHeaders = method === 'PUT'
    ? `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${stamp}\n`
    : `host:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${stamp}\n`;
  const signedHeaders = method === 'PUT' ? 'content-type;host;x-amz-content-sha256;x-amz-date' : 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, uri, '', canonicalHeaders, signedHeaders, hash].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, await sha256(encoder.encode(canonicalRequest))].join('\n');
  let signingKey = await hmac('AWS4' + secretKey, day);
  signingKey = await hmac(signingKey, region);
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, stringToSign));
  const headers: Record<string, string> = {
    'x-amz-content-sha256': hash,
    'x-amz-date': stamp,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`
  };
  if (method === 'PUT') headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(origin + uri, {
      method, headers, ...(method === 'PUT' ? { body: body as BodyInit } : {}),
      credentials: 'omit', redirect: 'error', cache: 'no-store'
    });
  } catch {
    throw new Error('无法连接七牛 S3。请检查存储桶 HTTPS 地址、网络和扩展权限。');
  }
  if (!response.ok) {
    const raw = (await response.text().catch(() => '')).slice(0, 4096);
    const code = /<Code>([A-Za-z0-9_-]+)<\/Code>/.exec(raw)?.[1];
    throw new Error(`七牛云 HTTP ${response.status}${code ? ' · ' + code : ''}，请核对区域、密钥和存储空间权限。`);
  }
  return response;
}
export async function uploadExpertPresetsJson(config: QiniuCloudConfig, text: string): Promise<void> {
  const bytes = encoder.encode(text);
  if (!bytes.length || bytes.length > CLOUD_PRESET_MAX_BYTES) throw new Error('预设 JSON 为空或超过 5 MiB。');
  await signedRequest('PUT', config, bytes);
}

export async function downloadExpertPresetsJson(config: QiniuCloudConfig): Promise<string> {
  const response = await signedRequest('GET', config);
  const declaredLength = response.headers.get('Content-Length');
  if (declaredLength !== null && Number(declaredLength) > CLOUD_PRESET_MAX_BYTES) {
    await response.body?.cancel();
    throw new Error('云端预设 JSON 超过 5 MiB，已拒绝下载。');
  }
  if (!response.body) throw new Error('无法读取云端响应正文。');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > CLOUD_PRESET_MAX_BYTES) throw new Error('云端预设 JSON 超过 5 MiB，已停止下载。');
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('云端预设 JSON 不是有效的 UTF-8 文本。'); }
}



