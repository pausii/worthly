/**
 * HTTP CONNECT proxy client untuk Cloudflare Workers.
 * Menggunakan `cloudflare:sockets` TCP + startTls() agar bisa melewati
 * geo-block pada target HTTPS (mis. api.binance.com dari IP yang diblokir).
 *
 * Alur: TCP → CONNECT ke proxy → 200 → startTls() → HTTP/1.1 request → response.
 */
import { connect } from 'cloudflare:sockets';

const enc = new TextEncoder();
const dec = new TextDecoder();

// Gunakan Uint8Array<ArrayBufferLike> agar kompatibel dengan semua sumber (slice, dll)
type Buf = Uint8Array<ArrayBufferLike>;

function concat(...arrays: Buf[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a as Uint8Array<ArrayBuffer>, off);
    off += a.length;
  }
  return out;
}

function findDoubleCRLF(buf: Buf): number {
  for (let i = 0; i <= buf.length - 4; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

function decodeChunked(data: Buf): Uint8Array<ArrayBuffer> {
  const out: Buf[] = [];
  let pos = 0;
  while (pos < data.length) {
    let lineEnd = -1;
    for (let i = pos; i < data.length - 1; i++) {
      if (data[i] === 13 && data[i + 1] === 10) {
        lineEnd = i;
        break;
      }
    }
    if (lineEnd === -1) break;
    const size = parseInt(dec.decode(data.slice(pos, lineEnd)).split(';')[0].trim(), 16);
    if (!size || isNaN(size)) break;
    pos = lineEnd + 2;
    out.push(data.slice(pos, pos + size));
    pos += size + 2;
  }
  return concat(...out);
}

/** Baca stream sampai header HTTP selesai (\r\n\r\n ditemukan). */
async function readUntilHeaders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reader: ReadableStreamDefaultReader<any>,
): Promise<{ header: string; leftover: Uint8Array<ArrayBuffer> }> {
  let buf: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return { header: dec.decode(buf), leftover: new Uint8Array(0) };
    buf = concat(buf, value as Buf);
    const idx = findDoubleCRLF(buf);
    if (idx !== -1) {
      return { header: dec.decode(buf.slice(0, idx + 4)), leftover: concat(buf.slice(idx + 4)) };
    }
  }
}

/** Parse + baca full HTTP response dari ReadableStream yang ditutup server setelah response. */
async function readHTTPResponse(
  readable: ReadableStream,
): Promise<{ status: number; body: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader = (readable as ReadableStream<any>).getReader();
  const { header, leftover } = await readUntilHeaders(reader);

  const status = parseInt(header.split(' ')[1] ?? '0', 10);

  let contentLength = -1;
  let chunked = false;
  for (const line of header.split('\r\n').slice(1)) {
    const ll = line.toLowerCase();
    if (ll.startsWith('content-length:')) contentLength = parseInt(line.split(':')[1].trim(), 10);
    if (ll.startsWith('transfer-encoding:') && ll.includes('chunked')) chunked = true;
  }

  let bodyBuf: Uint8Array<ArrayBuffer> = leftover;
  if (contentLength >= 0) {
    while (bodyBuf.length < contentLength) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBuf = concat(bodyBuf, value as Buf);
    }
    reader.releaseLock();
    return { status, body: dec.decode(bodyBuf.slice(0, contentLength)) };
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bodyBuf = concat(bodyBuf, value as Buf);
  }
  reader.releaseLock();
  return { status, body: chunked ? dec.decode(decodeChunked(bodyBuf)) : dec.decode(bodyBuf) };
}

/**
 * Kirim HTTP GET/POST request melalui HTTP CONNECT proxy ke target HTTPS.
 * `proxyUrl` format: `http://user:pass@host:port`
 */
export async function fetchViaProxy(
  proxyUrl: string,
  targetUrl: string,
  method: string,
  reqHeaders: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const proxy = new URL(proxyUrl);
  const target = new URL(targetUrl);
  const proxyPort = Number(proxy.port) || 8080;

  // Langkah 1: koneksi TCP ke proxy
  // secureTransport:'starttls' wajib agar startTls() bisa dipanggil setelah CONNECT.
  const socket = connect({ hostname: proxy.hostname, port: proxyPort }, { secureTransport: 'starttls', allowHalfOpen: false });

  // Langkah 2: kirim HTTP CONNECT
  const authLine = proxy.username
    ? `Proxy-Authorization: Basic ${btoa(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`)}\r\n`
    : '';
  const connectMsg =
    `CONNECT ${target.hostname}:443 HTTP/1.1\r\n` +
    `Host: ${target.hostname}:443\r\n` +
    authLine +
    `\r\n`;

  const tcpWriter = socket.writable.getWriter();
  await tcpWriter.write(enc.encode(connectMsg));
  tcpWriter.releaseLock();

  // Langkah 3: baca respons CONNECT (harus "200 Connection established")
  const tcpReader = (socket.readable as ReadableStream<unknown>).getReader();
  const { header: connectHeader } = await readUntilHeaders(tcpReader);
  tcpReader.releaseLock();

  const connectStatus = parseInt(connectHeader.split(' ')[1] ?? '0', 10);
  if (connectStatus !== 200) {
    await socket.close().catch(() => undefined);
    throw new Error(`Proxy CONNECT gagal ${connectStatus}: ${connectHeader.split('\r\n')[0]}`);
  }

  // Langkah 4: upgrade ke TLS (tunnel ke target sudah terbuka)
  const tls = socket.startTls({ expectedServerHostname: target.hostname });

  // Langkah 5: kirim HTTP/1.1 request
  const allHeaders: Record<string, string> = {
    Host: target.hostname,
    Connection: 'close',
    ...reqHeaders,
  };
  if (method === 'POST' && !allHeaders['Content-Length']) {
    allHeaders['Content-Length'] = '0';
  }
  const headerLines = Object.entries(allHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n');
  const httpReq = `${method} ${target.pathname}${target.search} HTTP/1.1\r\n${headerLines}\r\n\r\n`;

  const tlsWriter = tls.writable.getWriter();
  await tlsWriter.write(enc.encode(httpReq));
  await tlsWriter.close();

  // Langkah 6: baca HTTP response
  return readHTTPResponse(tls.readable);
}
