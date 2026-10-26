#!/usr/bin/env node
/*
  ZOMBIE SURVIVAL — сервер для игры по Wi-Fi.
  Запуск:  node server.js        (или двойной клик по start.bat)
  Порт:    node server.js 8080   (по умолчанию 3000)
  Никаких пакетов ставить не нужно — нужен только Node.js (nodejs.org, версия LTS).

  Что делает сервер:
   1) раздаёт игру (index.html + three.min.js) всем устройствам в сети;
   2) пересылает сообщения между игроками (WebSocket, написан вручную);
   3) хранит одну комнату: первый, кто нажал «СОЗДАТЬ ИГРУ» — хост (считает зомби),
      остальные нажимают «ПРИСОЕДИНИТЬСЯ».
*/
'use strict';
const http = require('http'), https = require('https'), fs = require('fs');
const path = require('path'), crypto = require('crypto'), os = require('os');

const PORT = +process.env.PORT || +process.argv[2] || 3000;
const DIR = __dirname;
const PROFILE = 'pc';                 // 'pc' или 'phone' (только текст подсказок)
const HTTPS_PORT = +process.env.HTTPS_PORT || PORT + 443;   // для гироскопа на телефонах (датчики работают только по HTTPS)
const MAXP = 8;                       // максимум игроков
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/* ---------- самоподписанный сертификат (только для игры по домашней сети) ---------- */
const TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCcpv72ixt6rB8F
QqJH65JyUVGeF5SbZrcumEpy6PMVZYWGYs2rHw3pb1BpzsGWREHVKZFR81YfPwtv
TBR+xQkkxYTSO1rsGvNbepsa/N5nnw28cVumnJFzD7ePiMjdngIx6e/pw2Kaz1uh
KlO6nEqBioTZz89Zx4LHxzkxf1iUi1yvnUpGF+8O3cPTJDgZzFEeC4WTD4zCQq9q
t7JLlFvu1KMqZ5lt35HNwaT+HtfuHXv6DbmpS4erbhE+MA570Gffi47hjAjJ1q43
8bG8kUK35naTENazqwqGPYERjbTNcA3lmRxGIXVLcDFOH0x2cXTq0lWuigsyPpBJ
68hUZzLVAgMBAAECgf9fQSxyviOiHwdogMbXn2cYHFqExydArN9hII7PUNcp1jxb
Jbk/VKLLpI7rx81EkjzLDCZRWVCvr1DvXFPEwgsipk3IMvoWl6INqNVSk8X+kbjI
iCWIKlbx9Zyoqtl5PkYXaSjOpwBOd8g/4n0HUVdSGJNaiVfhlRpGYIi75bOh9ChY
/2MHQFE6EcPaoTK2lasZnlv8pdUbFSygykPFMVMedWLNPRYAqA7OUtZ86ZiEgIJS
QtOn8YAFDId38wrJI7agi+q1b66wAkLe4jsFHAQ9p2TGdSUWCq57ajYL9wJmtsK1
cV4tDLCTbVzMCVMOFNOLW3RCCJuBsGyoJkazqA0CgYEA0Cw3nC+8hvtclw2zLjbv
Q6vjj+PuFoYV1zT+T0gUy+/9tO1vSd4vDYc8FlmXqUcfFtGcftgSGnbXkYRKVelL
JghFILFl2h77kzqO1n6qd9UWZql1zSRmJPjy4h1r/r8+b+U7YMU6lc/EMcTZFmwa
OlyhT19vpfmHmGCrN6v+KZcCgYEAwKSUtkRzgZpE43DrvsUSJYlBhE+8WH2MULyi
ihv2XICRB5Mae5E1oAU1j4A16fiDAsayODZ3qZDgJhHqXOnuPDHYcrOuCTAF8p9o
uFETruakzxHeC/RgI7suEmiaxEEU2IJ/l/NVRygn/PmLFP/OYP7QjCZIqfO0V0YM
DMqCHHMCgYA9tH2fXD8Du8pMNBFip4Hwiyje4+8U2hXrPpgLJBCWCsMnOCH+wU8t
MWLMNS5RTPWYK/W5W46yLXvkdFQcdxSBZ34mHK9WIkzr7TWdutoIvy7uq1hxwFJO
r0Q/Zf02+7UkMcyR+KRO99Dt961pig2UMxTVlDJh/j8FGdJmpCKobQKBgEuwHjGi
oVM5XnmSAz23xhJzZAdtII4P/dI22xGyPNBJPzIfrNcBzXTqtwmDkSs1FZxAnwMQ
+2Dm5/ptLYyF6LFD0Ev4ppc7hAq4cPeB+17LhdNJrNk7kY5YW5il+rDC9UK/uwvj
cgz8DQIKtYdxng9j7mIyJHiJpMBpaBCafBZbAoGAGFbe66W8cJ0MhlHoYRd3bqV1
DKFzoeSqUJZpC34YFORez1GWbi4r5MwkwREmwW0G1f/dyaj0HhnLeMT4+wOdXlBw
ts9CNJd8mjyJcrEwRaftR90OigrpkwGj+Y4BVXuhI3K9v9EGklfZHuU5kRlw3c/s
RLGcdm+bE706qX4uT+8=
-----END PRIVATE KEY-----
`;
const TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIDMzCCAhugAwIBAgIUW2K2BTwWljzQhLzu8QSotCUaUjQwDQYJKoZIhvcNAQEL
BQAwFTETMBEGA1UEAwwKem9tYmllLWxhbjAeFw0yNjEwMTkwMzQ5MDZaFw00NjEw
MTQwMzQ5MDZaMBUxEzARBgNVBAMMCnpvbWJpZS1sYW4wggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQCcpv72ixt6rB8FQqJH65JyUVGeF5SbZrcumEpy6PMV
ZYWGYs2rHw3pb1BpzsGWREHVKZFR81YfPwtvTBR+xQkkxYTSO1rsGvNbepsa/N5n
nw28cVumnJFzD7ePiMjdngIx6e/pw2Kaz1uhKlO6nEqBioTZz89Zx4LHxzkxf1iU
i1yvnUpGF+8O3cPTJDgZzFEeC4WTD4zCQq9qt7JLlFvu1KMqZ5lt35HNwaT+Htfu
HXv6DbmpS4erbhE+MA570Gffi47hjAjJ1q438bG8kUK35naTENazqwqGPYERjbTN
cA3lmRxGIXVLcDFOH0x2cXTq0lWuigsyPpBJ68hUZzLVAgMBAAGjezB5MB0GA1Ud
DgQWBBSONHkbD+KUTv5/CT2h89lny0qyLTAfBgNVHSMEGDAWgBSONHkbD+KUTv5/
CT2h89lny0qyLTAPBgNVHRMBAf8EBTADAQH/MCYGA1UdEQQfMB2CCWxvY2FsaG9z
dIIKem9tYmllLWxhbocEfwAAATANBgkqhkiG9w0BAQsFAAOCAQEAXLrMtx9ASdRc
ed79odiT8iXA/p3pSxQeA4C85qjsg9pRW+U/q29GE/RDmNjEEoRstJt3T2OEfrFf
9uKhB8UW9dhUdSR5dBTKNT873GhqLQdprQFoheQwI9bgKufSoflZ4FxHGfUWjgmL
Fp2it8XzenBILr0g4LBiFvpQ1zUzZH5yt9ldQocmBJ5/Gj6awMwABQFw4KAM/g0k
jCNhYk/Zz67OsVHDr1ePJtpPnTCdHw2Rgh/d+1PzFsbiKf83lORf3AQHtN5IXUDi
UrpXxHiKA9ZYQZDoDL6tu2cNLw45cKWPcVZy6S0yZvZ/Co7RtWwYSzflbc9K35nt
peUrFbs/ew==
-----END CERTIFICATE-----
`;

/* ---------- адреса компьютера в локальной сети ---------- */
function lanIps() {
  const r = [];
  try {
    const n = os.networkInterfaces();
    for (const k in n) for (const a of n[k] || [])
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal) r.push(a.address);
  } catch (e) { /* на некоторых телефонах запрещено — пробуем команды ниже */ }
  if (!r.length) {
    for (const cmd of ['ip -4 addr', 'ifconfig']) {
      try {
        const out = require('child_process').execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
        for (const x of (out.match(/inet (?:addr:)?(\d+\.\d+\.\d+\.\d+)/g) || [])) {
          const ip = x.replace(/inet (?:addr:)?/, '');
          if (!ip.startsWith('127.') && !r.includes(ip)) r.push(ip);
        }
      } catch (e) { }
      if (r.length) break;
    }
  }
  const pri = ip => /^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  return r.sort((a, b) => pri(a) - pri(b));
}

/* ---------- комната ---------- */
let nid = 0, hostId = null;
const CL = new Map();                 // id -> клиент
const joined = () => [...CL.values()].filter(c => c.name != null).length;

function uniq(name) {
  let n = String(name || 'Игрок').replace(/[^\wа-яА-ЯёЁ \-.]/g, '').trim().slice(0, 16) || 'Игрок';
  const used = new Set([...CL.values()].map(c => c.name)), base = n;
  for (let i = 2; used.has(n); i++) n = base.slice(0, 13) + ' ' + i;
  return n;
}
function roster() {
  return { s: 'players', host: hostId, list: [...CL.values()].filter(c => c.name != null).map(c => ({ id: c.id, name: c.name })) };
}
function bcRoster() {
  const t = JSON.stringify(roster());
  for (const c of CL.values()) if (c.name != null) send(c, t);
}

/* ---------- WebSocket (RFC 6455), минимальная реализация ---------- */
function frame(sock, op, payload) {
  if (sock.destroyed) return;
  const len = payload.length;
  let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  sock.write(Buffer.concat([h, payload]));
}
function send(c, obj) {
  if (c.sock.destroyed) return;
  if (c.sock.writableLength > 2e6) { drop(c); return; }      // клиент совсем завис
  frame(c.sock, 1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)));
}
function makeParser(onText, onClose, onPing) {
  let buf = Buffer.alloc(0), frag = [];
  return chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const b0 = buf[0], b1 = buf[1], fin = !!(b0 & 0x80), op = b0 & 15, masked = !!(b1 & 0x80);
      let len = b1 & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { onClose(); return; }
      const hdr = off + (masked ? 4 : 0), need = hdr + len;
      if (buf.length < need) return;
      let payload = Buffer.from(buf.subarray(hdr, need));
      if (masked) { const m = buf.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { onClose(); return; }
      if (op === 9) { onPing(payload); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2) frag = [payload]; else if (op === 0) frag.push(payload);
      if (fin && frag.length) { const full = Buffer.concat(frag); frag = []; onText(full.toString('utf8')); }
    }
  };
}

function drop(c) {
  if (!CL.has(c.id)) return;
  CL.delete(c.id);
  try { c.sock.destroy(); } catch (e) { }
  if (c.name == null) return;
  console.log('[-] вышел: ' + c.name);
  if (c.id === hostId) {                                   // хост ушёл — комната закрывается
    hostId = null;
    const rest = [...CL.values()];
    for (const o of rest) { if (o.name != null) send(o, { s: 'hostgone' }); }
    CL.clear();
    setTimeout(() => rest.forEach(o => { try { o.sock.end(); } catch (e) { } }), 300);
    console.log('[!] хост вышел, игра закрыта. Можно создать новую.');
  } else bcRoster();
}

function onMsg(c, txt) {
  if (txt.length > 200000) return;
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;

  if (m.s === 'host' || m.s === 'join') {
    if (c.name != null) return;
    if (m.s === 'host' && hostId != null) return send(c, { s: 'err', code: 'hostexists' });
    if (m.s === 'join' && hostId == null) return send(c, { s: 'err', code: 'nohost' });
    if (joined() >= MAXP) return send(c, { s: 'err', code: 'full' });
    c.name = uniq(m.name);
    if (m.s === 'host') hostId = c.id;
    send(c, { s: 'welcome', id: c.id, name: c.name });
    bcRoster();
    console.log((m.s === 'host' ? '[+] ХОСТ: ' : '[+] игрок: ') + c.name + '  (всего: ' + joined() + ')');
    return;
  }
  if (c.name == null) return;
  if (m.s === 'm' && m.m && typeof m.m === 'object') {
    const out = JSON.stringify({ s: 'm', f: c.id, m: m.m });
    if (m.to === 'all') { for (const o of CL.values()) if (o !== c && o.name != null) send(o, out); }
    else {
      const o = CL.get(m.to === 'host' ? hostId : +m.to);
      if (o && o !== c && o.name != null) send(o, out);
    }
  }
}

/* ---------- HTTP: раздаём игру ---------- */
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/three.min.js': 'three.min.js' };
const handle = (req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ips: lanIps(), port: PORT, host: hostId != null, players: joined(), httpsPort: secure ? HTTPS_PORT : null }));
  }
  const f = FILES[u];
  if (!f) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(DIR, f), (e, d) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Файл ' + f + ' не найден рядом с server.js'); }
    res.writeHead(200, {
      'Content-Type': f.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(d);
  });
};
const server = http.createServer(handle);
let secure = null;
try { secure = https.createServer({ key: TLS_KEY, cert: TLS_CERT }, handle); } catch (e) { secure = null; }

const onUpgrade = (req, sock, head) => {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true); sock.setKeepAlive(true, 20000);
  const c = { id: ++nid, sock, name: null, last: Date.now() };
  CL.set(c.id, c);
  const parse = makeParser(t => onMsg(c, t), () => { try { frame(sock, 8, Buffer.alloc(0)); } catch (e) { } drop(c); }, p => frame(sock, 10, p));
  sock.on('data', d => { c.last = Date.now(); try { parse(d); } catch (e) { drop(c); } });
  sock.on('close', () => drop(c));
  sock.on('error', () => drop(c));
  if (head && head.length) parse(head);
};
server.on('upgrade', onUpgrade);
if (secure) secure.on('upgrade', onUpgrade);

// проверка живых соединений (телефон выключили / ушёл из Wi-Fi)
setInterval(() => {
  const now = Date.now();
  for (const c of [...CL.values()]) {
    if (now - c.last > 45000) drop(c); else frame(c.sock, 9, Buffer.alloc(0));
  }
}, 15000);

/* ---------- three.min.js: если рядом нет — скачиваем один раз ---------- */
function ensureThree(cb) {
  const f = path.join(DIR, 'three.min.js');
  if (fs.existsSync(f)) return cb();
  console.log('three.min.js не найден — пробую скачать (нужен интернет, один раз)…');
  let done = false; const fin = () => { if (!done) { done = true; cb(); } };
  setTimeout(() => { if (!done) console.log('  не удалось скачать (нет интернета). Положите three.min.js рядом с server.js.'); fin(); }, 12000);
  https.get(THREE_URL, r => {
    if (r.statusCode !== 200) { console.log('  не удалось скачать: HTTP ' + r.statusCode); r.resume(); return fin(); }
    const ch = []; r.on('data', d => ch.push(d));
    r.on('end', () => { try { fs.writeFileSync(f, Buffer.concat(ch)); console.log('  three.min.js сохранён.'); } catch (e) { console.log('  не удалось сохранить файл: ' + e.message); } fin(); });
  }).on('error', e => { console.log('  не удалось скачать: ' + e.message); fin(); });
}

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.log('Порт ' + PORT + ' занят. Закройте другой сервер или запустите так:  node server.js ' + (PORT + 1));
  else console.log('Ошибка сервера: ' + e.message);
  process.exit(1);
});

function startSecure() {
  if (!secure) return;
  secure.on('error', e => console.log('HTTPS (для гироскопа) не запущен: ' + e.message));
  secure.listen(HTTPS_PORT, '0.0.0.0');
}
ensureThree(() => server.listen(PORT, '0.0.0.0', () => {
  startSecure();
  if (!fs.existsSync(path.join(DIR, 'index.html'))) console.log('ВНИМАНИЕ: рядом с server.js нет index.html!');
  console.log('\n=== ZOMBIE SURVIVAL: сервер запущен ===\n');
  console.log((PROFILE === 'phone' ? 'На ЭТОМ телефоне откройте:   http://localhost:' : 'На ЭТОМ компьютере откройте:   http://localhost:') + PORT);
  const ips = lanIps();
  if (ips.length) { console.log('\nНа ТЕЛЕФОНАХ (та же Wi-Fi сеть) откройте:'); ips.forEach(ip => console.log('   http://' + ip + ':' + PORT)); }
  else if (PROFILE === 'phone') console.log('\nАдрес не определился. Откройте Настройки → Wi-Fi (или «Точка доступа») и посмотрите IP телефона.\nЕсли телефон раздаёт точку доступа — обычно это http://192.168.43.1:' + PORT);
  else console.log('\nСеть не найдена: подключите компьютер к Wi-Fi.');
  if (secure && ips.length) {
    console.log('\nГИРОСКОП на телефоне работает только по https. Откройте:');
    ips.forEach(ip => console.log('   https://' + ip + ':' + HTTPS_PORT));
    console.log('(браузер предупредит о сертификате: «Дополнительно» → «Продолжить» — это нормально для домашней сети)');
  }
  console.log(PROFILE === 'phone' ? '\nДальше: ОДИН игрок (лучше на самом мощном устройстве) — меню → «ПО СЕТИ» → «СОЗДАТЬ ИГРУ», остальные → «ПРИСОЕДИНИТЬСЯ».' : '\nДальше: на компьютере  меню → «ПО СЕТИ» → «СОЗДАТЬ ИГРУ»; на телефонах → «ПРИСОЕДИНИТЬСЯ».');
  console.log('Остановить сервер: Ctrl+C\n');
}));
