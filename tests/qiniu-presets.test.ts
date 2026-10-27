import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { CLOUD_PRESET_OBJECT_KEY, CLOUD_PRESET_MAX_BYTES, parseQiniuEndpoint, uploadExpertPresetsJson, downloadExpertPresetsJson } from '../src/sidepanel/qiniu-presets';

const config = { endpoint: 'https://test-bucket.s3.cn-east-1.qiniucs.com', accessKey: 'ExampleAccessKey', secretKey: 'LocalTestSecretOnly' };
assert.equal(parseQiniuEndpoint(config.endpoint).region, 'cn-east-1');
for (const invalid of ['http://test-bucket.s3.cn-east-1.qiniucs.com', 'https://test-bucket.s3.cn-east-1.qiniucs.com.evil.org', 'https://evil.example', 'https://test-bucket.s3.cn-east-1.qiniucs.com/sneaky', 'https://test-bucket.s3.cn-east-1.qiniucs.com?x=1', 'https://a:b@test-bucket.s3.cn-east-1.qiniucs.com']) {
  assert.throws(() => parseQiniuEndpoint(invalid), /地址|HTTPS/, invalid);
}
const nativeFetch = globalThis.fetch;
const calls: Array<{ url: string; init: RequestInit }> = [];
const payload = '{"type":"multi-ai-roundtable-expert-presets","version":1,"experts":[{"name":"测试","prompt":"测试提示词"}]}';
(globalThis as any).fetch = async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return new Response(init.method === 'GET' ? payload : '', { status: 200, headers: { 'Content-Type': 'application/json' } });
};
try {
  await uploadExpertPresetsJson(config, payload);
  const request = calls.at(-1)!;
  assert.equal(request.url, config.endpoint + '/' + CLOUD_PRESET_OBJECT_KEY);
  assert.equal(request.init.method, 'PUT');
  assert.equal(request.init.redirect, 'error');
  assert.equal(request.init.credentials, 'omit');
  const headers = request.init.headers as Record<string, string>;
  assert.equal(headers['Content-Type'], 'application/json');
  const body = Buffer.from(request.init.body as Uint8Array);
  assert.equal(body.toString('utf8'), payload);
  const sha = (input: Buffer | string) => createHash('sha256').update(input).digest('hex');
  assert.equal(headers['x-amz-content-sha256'], sha(body));
  const stamp = headers['x-amz-date'];
  const day = stamp.slice(0, 8);
  const scope = day + '/cn-east-1/s3/aws4_request';
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = 'content-type:application/json\nhost:test-bucket.s3.cn-east-1.qiniucs.com\nx-amz-content-sha256:' + sha(body) + '\nx-amz-date:' + stamp + '\n';
  const canonicalRequest = ['PUT', '/' + CLOUD_PRESET_OBJECT_KEY, '', canonicalHeaders, signedHeaders, sha(body)].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha(canonicalRequest)].join('\n');
  const mac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value).digest();
  let key = mac('AWS4' + config.secretKey, day);
  key = mac(key, 'cn-east-1');
  key = mac(key, 's3');
  key = mac(key, 'aws4_request');
  const expectedSignature = mac(key, stringToSign).toString('hex');
  assert.ok(headers.Authorization.endsWith('Signature=' + expectedSignature), '签名必须符合 AWS SigV4');
  assert.ok(!request.url.includes(config.secretKey));
  const downloaded = await downloadExpertPresetsJson(config);
  assert.equal(downloaded, payload);
  assert.equal(calls.at(-1)!.init.method, 'GET');
  await assert.rejects(() => uploadExpertPresetsJson(config, 'x'.repeat(CLOUD_PRESET_MAX_BYTES + 1)), /超过 5 MiB/);
  (globalThis as any).fetch = async () => new Response('too large', { status: 200, headers: { 'Content-Length': String(CLOUD_PRESET_MAX_BYTES + 1) } });
  await assert.rejects(() => downloadExpertPresetsJson(config), /超过 5 MiB/);
  (globalThis as any).fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(CLOUD_PRESET_MAX_BYTES + 1)); controller.close(); }
  }), { status: 200 });
  await assert.rejects(() => downloadExpertPresetsJson(config), /超过 5 MiB/);
  (globalThis as any).fetch = async () => new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
  await assert.rejects(() => downloadExpertPresetsJson(config), /HTTP 404.*NoSuchKey/);
} finally {
  globalThis.fetch = nativeFetch;
}
console.log('qiniu S3 expert preset transport tests passed');

