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


/* ---------- администратор (проверка ТОЛЬКО на сервере; пароль в игре и на странице нигде не хранится) ---------- */
const ADMIN_FILE = path.join(DIR, 'admin.json'), SITE_FILE = path.join(process.env.DATA_DIR || DIR, 'site.json');
const hashPass = (pass, saltHex) => crypto.scryptSync(String(pass), Buffer.from(saltHex, 'hex'), 32, { N: 16384, r: 8, p: 1 }).toString('hex');
if (process.argv[2] === 'setadmin') {                     // node server.js setadmin ЛОГИН ПАРОЛЬ
  const login = process.argv[3], pass = process.argv[4];
  if (!login || !pass || pass.length < 8) { console.log('Использование:  node server.js setadmin ЛОГИН ПАРОЛЬ   (пароль — минимум 8 символов)'); process.exit(1); }
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ login, salt, hash: hashPass(pass, salt) }, null, 2));
  console.log('Готово: админ «' + login + '» сохранён в admin.json (пароль в файле не хранится, только хеш).'); process.exit(0);
}
let ADMIN = null, ADMIN_SRC = '';
(function loadAdmin() {
  if (process.env.ADMIN_LOGIN && process.env.ADMIN_PASS) {   // лучший вариант для хостинга: переменные окружения
    const salt = crypto.randomBytes(16).toString('hex');
    ADMIN = { login: String(process.env.ADMIN_LOGIN), salt, hash: hashPass(process.env.ADMIN_PASS, salt) }; ADMIN_SRC = 'переменные окружения'; return;
  }
  try { const j = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8')); if (j.login && j.salt && j.hash) { ADMIN = j; ADMIN_SRC = 'admin.json'; } } catch (e) { }
})();
let SITE = { announce: '' };
try { SITE = Object.assign(SITE, JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'))); } catch (e) { }
const saveSite = () => { try { fs.writeFileSync(SITE_FILE, JSON.stringify(SITE)); } catch (e) { console.log('site.json: ' + e.message); } };
const SESS = new Map(), FAILS = new Map();               // токены входа и счётчик неудачных попыток по IP
let adminSeen = 0;
const ipOf = req => String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '');
function sessOk(tok) { tok = String(tok || ''); const s = SESS.get(tok); if (!s) return null; if (Date.now() > s.exp) { SESS.delete(tok); return null; } return s; }
function checkLogin(login, pass) {
  if (!ADMIN) return false;
  const a = Buffer.from(String(login || '')), b = Buffer.from(ADMIN.login);
  const okL = a.length === b.length && crypto.timingSafeEqual(a, b);
  const okP = crypto.timingSafeEqual(Buffer.from(hashPass(pass || '', ADMIN.salt), 'hex'), Buffer.from(ADMIN.hash, 'hex'));   // хеш считаем всегда — время ответа не выдаёт верный логин
  return okL && okP;
}
const jsonRes = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(o)); };
function readJson(req, res, cb) {
  let d = '', len = 0, dead = false;
  req.on('data', c => { len += c.length; if (len > 20000) { dead = true; res.writeHead(413); res.end(); req.destroy(); return; } d += c; });
  req.on('end', () => { if (dead) return; let j = null; try { j = JSON.parse(d || '{}'); } catch (e) { } cb(j && typeof j === 'object' ? j : {}); });
}
function broadcastAll(obj) { const t = JSON.stringify(obj); for (const c of CL.values()) if (c.name != null) send(c, t); }
function adminLoginRoute(req, res) {
  const ip = ipOf(req), f = FAILS.get(ip) || { n: 0, until: 0 };
  if (f.until > Date.now()) return jsonRes(res, 429, { ok: false, err: 'Слишком много неверных попыток. Подождите 10 минут.' });
  if (!ADMIN) return jsonRes(res, 503, { ok: false, err: 'Админ не настроен на сервере.' });
  readJson(req, res, j => {
    if (!checkLogin(j.login, j.pass)) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 600000; f.n = 0; } FAILS.set(ip, f);
      console.log('[ADMIN] неверный вход с ' + ip);
      return setTimeout(() => jsonRes(res, 401, { ok: false, err: 'Неверный логин или пароль' }), 600);
    }
    FAILS.delete(ip);
    const token = crypto.randomBytes(24).toString('hex');
    SESS.set(token, { login: ADMIN.login, exp: Date.now() + 12 * 3600 * 1000 }); adminSeen = Date.now();
    broadcastAll({ s: 'adm', text: '👑 Администратор вошёл на сайт' });
    console.log('[ADMIN] вход выполнен (' + ip + ')');
    jsonRes(res, 200, { ok: true, token, login: ADMIN.login });
  });
}
function closeRoom(r, code) {
  const rest = [...r.members.values()]; r.members.clear(); r.hostId = null; r.busy = false; r.mode = 'coop'; r.dead.clear();
  for (const o of rest) { if (o.name != null) send(o, { s: code }); o.room = null; o.name = null; }
  setTimeout(() => rest.forEach(o => { try { o.sock.end(); } catch (e) { } }), 300);
}
function adminApi(req, res) {
  readJson(req, res, j => {
    const tok = String(req.headers['x-admin-token'] || ''), s = sessOk(tok);
    if (!s) return jsonRes(res, 401, { ok: false, err: 'Нужен вход' });
    adminSeen = Date.now();
    const room = ROOMS.get(String(j.room));
    switch (j.act) {
      case 'state': return jsonRes(res, 200, { ok: true, login: s.login, online: totalJoined(), announce: SITE.announce || '',
        rooms: ROOM_LIST.map(r => ({ id: r.id, city: r.city, n: r.n, mode: r.mode, busy: r.busy, hostId: r.hostId,
          players: [...r.members.values()].filter(c => c.name != null).map(c => ({ id: c.id, name: c.name, admin: !!c.admin })) })) });
      case 'kick': { const c = room && room.members.get(+j.id); if (!c) return jsonRes(res, 404, { ok: false, err: 'Нет такого игрока' });
        send(c, { s: 'kicked' }); setTimeout(() => drop(c), 250); console.log('[ADMIN] выгнан: ' + c.name); return jsonRes(res, 200, { ok: true }); }
      case 'close': if (!room) return jsonRes(res, 404, { ok: false, err: 'Нет такой комнаты' }); closeRoom(room, 'roomclosed'); console.log('[ADMIN] комната закрыта: ' + roomName(room)); return jsonRes(res, 200, { ok: true });
      case 'say': { const text = String(j.text || '').trim().slice(0, 200); if (!text) return jsonRes(res, 400, { ok: false, err: 'Пустой текст' });
        const msg = JSON.stringify({ s: 'say', name: s.login, text });
        if (j.room === 'all') { for (const c of CL.values()) if (c.name != null) send(c, msg); }
        else if (room) { for (const c of room.members.values()) send(c, msg); } else return jsonRes(res, 404, { ok: false, err: 'Нет такой комнаты' });
        return jsonRes(res, 200, { ok: true }); }
      case 'grant': case 'revoke': {
        const k = String(j.name || '').toLowerCase(), u = ACC.users[k], cmd = String(j.cmd || '').toLowerCase().replace('/', '');
        if (!u) return jsonRes(res, 404, { ok: false, err: 'Нет такого аккаунта' });
        if (!GRANTABLE.includes(cmd)) return jsonRes(res, 400, { ok: false, err: 'Такую команду выдать нельзя. Можно: ' + GRANTABLE.join(', ') });
        u.perms = u.perms || []; if (j.act === 'grant') { if (!u.perms.includes(cmd)) u.perms.push(cmd); } else u.perms = u.perms.filter(x => x !== cmd);
        saveAcc(); pushPerms(k); console.log('[ADMIN] ' + j.act + ' /' + cmd + ' -> ' + u.name); return jsonRes(res, 200, { ok: true, perms: u.perms }); }
      case 'setkills': {
        const k = String(j.name || '').toLowerCase(), u = ACC.users[k]; if (!u) return jsonRes(res, 404, { ok: false, err: 'Нет такого аккаунта' });
        u.kills = Math.max(0, Math.min(1000000, Math.floor(+j.kills) || 0)); saveAcc(); pushRank(k, false); return jsonRes(res, 200, { ok: true, kills: u.kills, rank: rankOf(u.kills) }); }
      case 'accounts': return jsonRes(res, 200, { ok: true, total: Object.keys(ACC.users).length,
        list: Object.values(ACC.users).sort((a, b) => b.created - a.created).slice(0, 500).map(u => ({ name: u.name, created: u.created, last: u.last || 0, banned: !!u.banned, kills: u.kills || 0, rank: rankOf(u.kills || 0), perms: u.perms || [],
          online: [...CL.values()].some(c => c.acct === u.name.toLowerCase() && c.name != null) })) });
      case 'ban': case 'unban': case 'delacc': {
        const k = String(j.name || '').toLowerCase(), u = ACC.users[k]; if (!u) return jsonRes(res, 404, { ok: false, err: 'Нет такого аккаунта' });
        if (j.act === 'delacc') delete ACC.users[k]; else u.banned = j.act === 'ban';
        saveAcc(); if (j.act !== 'unban') kickAccount(k); console.log('[ADMIN] ' + j.act + ': ' + u.name); return jsonRes(res, 200, { ok: true }); }
      case 'site': SITE.announce = String(j.announce || '').slice(0, 600); saveSite(); return jsonRes(res, 200, { ok: true });
      case 'logout': SESS.delete(tok); return jsonRes(res, 200, { ok: true });
      default: return jsonRes(res, 400, { ok: false, err: 'Неизвестное действие' });
    }
  });
}
const ADMIN_HTML = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Админ — Zombie Survival</title>
<style>body{font-family:Arial,sans-serif;background:#10141c;color:#eee;margin:0;padding:14px}h1,h2{color:#ffd23f;margin:6px 0}input,textarea,button,select{font-size:15px;padding:8px 10px;border-radius:6px;border:1px solid #556;background:#1b2230;color:#fff;box-sizing:border-box}button{cursor:pointer;background:#2a6a9a;border:0}button.r{background:#a03030}button.s{padding:3px 8px;font-size:13px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #334;padding:6px 8px;text-align:left;vertical-align:top;font-size:14px}.box{background:#161c28;border:1px solid #334;border-radius:8px;padding:12px;margin:12px 0}small{opacity:.7}.pl{display:inline-block;margin:2px 6px 2px 0;padding:2px 6px;background:#222c40;border-radius:5px}</style></head><body>
<div id="lg" class="box" style="max-width:380px;margin:40px auto"><h1>🔑 Вход администратора</h1><p><input id="l" placeholder="Логин" autocomplete="off" style="width:100%"></p><p><input id="p" type="password" placeholder="Пароль" autocomplete="off" style="width:100%"></p><p><button id="go">ВОЙТИ</button> <span id="er" style="color:#ff8a8a"></span></p></div>
<div id="pn" style="display:none"><h1>👑 Админ-панель <small id="who"></small> <button class="s r" id="out">Выйти</button></h1>
<div class="box"><h2>Сообщение игрокам</h2><input id="mt" maxlength="200" placeholder="Текст сообщения" style="width:min(520px,100%)"> <select id="mr"><option value="all">Всем</option></select> <button id="ms">Отправить</button></div>
<div class="box"><h2>Текст на первой странице игры</h2><small>Блок «Уважаемые игроки…». Пусто — стандартный текст. Каждая строка — с новой строки.</small><br><textarea id="an" rows="4" maxlength="600" style="width:min(620px,100%)"></textarea><br><button id="sv">Сохранить</button> <span id="ok" style="color:#7fff9f"></span></div>
<div class="box"><h2>Игроки (аккаунты) <small id="ac"></small></h2><input id="af" placeholder="Поиск по имени" style="width:min(320px,100%)"><div style="max-height:320px;overflow:auto;margin-top:8px"><table><thead><tr><th>Имя</th><th>Ранг (убито)</th><th>Команды игрока</th><th>Был в игре</th><th>Статус</th><th></th></tr></thead><tbody id="arows"></tbody></table></div></div>
<div class="box"><h2>Комнаты <small id="on"></small></h2><table><thead><tr><th>Комната</th><th>Статус</th><th>Игроки</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
<script>
var T=sessionStorage.getItem('zs_admin_panel')||'';
function api(a,d,cb){d=d||{};d.act=a;fetch('/admin/api',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':T},body:JSON.stringify(d)}).then(function(r){return r.json().then(function(j){return{c:r.status,j:j}})}).then(function(x){if(x.c==401){logout(true);return}cb&&cb(x.j)}).catch(function(){})}
function show(on){document.getElementById('lg').style.display=on?'none':'block';document.getElementById('pn').style.display=on?'block':'none'}
function logout(q){T='';sessionStorage.removeItem('zs_admin_panel');show(false);if(!q)api('logout')}
document.getElementById('go').onclick=function(){var er=document.getElementById('er');er.textContent='';fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:document.getElementById('l').value.trim(),pass:document.getElementById('p').value})}).then(function(r){return r.json()}).then(function(j){if(j.ok){T=j.token;sessionStorage.setItem('zs_admin_panel',T);document.getElementById('p').value='';show(true);load(true);loadAcc()}else er.textContent=j.err||'Ошибка'}).catch(function(){er.textContent='Нет связи с сервером'})};
document.getElementById('out').onclick=function(){logout(false)};
document.getElementById('ms').onclick=function(){var t=document.getElementById('mt').value.trim();if(!t)return;api('say',{room:document.getElementById('mr').value,text:t},function(){document.getElementById('mt').value=''})};
document.getElementById('sv').onclick=function(){api('site',{announce:document.getElementById('an').value},function(j){document.getElementById('ok').textContent=j.ok?'Сохранено ✔':'Ошибка';setTimeout(function(){document.getElementById('ok').textContent=''},2500)})};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function load(first){api('state',{},function(j){if(!j.ok)return;document.getElementById('who').textContent='('+j.login+')';document.getElementById('on').textContent='— игроков онлайн: '+j.online;
 if(first)document.getElementById('an').value=j.announce||'';
 var sel=document.getElementById('mr'),cur=sel.value;sel.innerHTML='';var o=el('option',null,'Всем');o.value='all';sel.appendChild(o);j.rooms.forEach(function(r){var q=el('option',null,r.city+' — комната '+r.n);q.value=r.id;sel.appendChild(q)});sel.value=cur||'all';
 var tb=document.getElementById('rows');tb.innerHTML='';j.rooms.forEach(function(r){var tr=el('tr');tr.appendChild(el('td',null,r.city+' — '+r.n));
  tr.appendChild(el('td',null,r.hostId==null?'свободна':(r.mode=='duel'?'дуэль':'кооп')+(r.busy?' · идёт игра':' · ожидание')));
  var tp=el('td');r.players.forEach(function(p){var b=el('span','pl',(p.id==r.hostId?'★ ':'')+p.name+' ');var k=el('button','s r','выгнать');k.onclick=function(){if(confirm('Выгнать '+p.name+'?'))api('kick',{room:r.id,id:p.id},function(){load()})};b.appendChild(k);tp.appendChild(b)});tr.appendChild(tp);
  var tc=el('td');if(r.hostId!=null){var c=el('button','s r','закрыть комнату');c.onclick=function(){if(confirm('Закрыть комнату?'))api('close',{room:r.id},function(){load()})};tc.appendChild(c)}tr.appendChild(tc);tb.appendChild(tr)})})}
var CMDS=['god','heal','ammo','run','jump','power','rapid','freeze','gg','tpa','killall','say'];
var RN=['Солдат','Ефрейтор','Сержант','Старшина','Лейтенант','Капитан','Майор','Полковник','Генерал','Маршал'];
function loadAcc(){api('accounts',{},function(j){if(!j.ok)return;var f=(document.getElementById('af').value||'').toLowerCase();document.getElementById('ac').textContent='— всего: '+j.total;var tb=document.getElementById('arows');tb.innerHTML='';
 j.list.filter(function(u){return !f||u.name.toLowerCase().indexOf(f)>=0}).forEach(function(u){var tr=el('tr');
  tr.appendChild(el('td',null,(u.online?'🟢 ':'')+u.name));
  var tk=el('td',null,RN[u.rank-1]+' ('+u.kills+') ');var kb=el('button','s','изм.');kb.onclick=function(){var v=prompt('Сколько убитых зомби записать игроку '+u.name+'?',u.kills);if(v!==null)api('setkills',{name:u.name,kills:+v},function(){loadAcc()})};tk.appendChild(kb);tr.appendChild(tk);
  var tp=el('td');(u.perms||[]).forEach(function(c){var b=el('span','pl','/'+c+' ');var x=el('button','s r','✕');x.title='отобрать команду';x.onclick=function(){api('revoke',{name:u.name,cmd:c},function(){loadAcc()})};b.appendChild(x);tp.appendChild(b)});
  var sel=el('select');CMDS.forEach(function(c){if((u.perms||[]).indexOf(c)<0){var o=el('option',null,'/'+c);o.value=c;sel.appendChild(o)}});
  if(sel.options.length){var gb=el('button','s','выдать');gb.style.marginLeft='4px';gb.onclick=function(){api('grant',{name:u.name,cmd:sel.value},function(){loadAcc()})};tp.appendChild(sel);tp.appendChild(gb)}tr.appendChild(tp);
  tr.appendChild(el('td',null,u.last?new Date(u.last).toLocaleString('ru-RU'):'—'));
  tr.appendChild(el('td',null,u.banned?'🚫 заблокирован':'активен'));
  var tc=el('td'),b=el('button','s '+(u.banned?'':'r'),u.banned?'разблокировать':'заблокировать');b.onclick=function(){api(u.banned?'unban':'ban',{name:u.name},function(){loadAcc()})};tc.appendChild(b);
  var d=el('button','s r','удалить');d.style.marginLeft='6px';d.onclick=function(){if(confirm('Удалить аккаунт '+u.name+'?'))api('delacc',{name:u.name},function(){loadAcc()})};tc.appendChild(d);tr.appendChild(tc);tb.appendChild(tr)})})}
document.getElementById('af').oninput=function(){loadAcc()};
if(T){show(true);load(true);loadAcc()}
var tick=0;setInterval(function(){if(T){load();var a=document.activeElement;if(++tick%5==0&&!(a&&(a.tagName=='SELECT'||a.tagName=='INPUT')))loadAcc()}},3000);
</script></body></html>`;


/* ---------- аккаунты игроков (регистрация обязательна, «гостей» нет) ---------- */
// DATA_DIR — папка для accounts.json и site.json. На хостинге с временным диском (Render без Disk)
// аккаунты сбрасываются при перезапуске; для постоянных аккаунтов подключите Disk и задайте DATA_DIR.
const DATA_DIR = process.env.DATA_DIR || DIR;
const ACC_FILE = path.join(DATA_DIR, 'accounts.json');
let ACC = { secret: '', users: {} };
try { ACC = Object.assign(ACC, JSON.parse(fs.readFileSync(ACC_FILE, 'utf8'))); } catch (e) { }
if (!ACC.secret) ACC.secret = crypto.randomBytes(32).toString('hex');
function saveAcc() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ACC_FILE + '.tmp', JSON.stringify(ACC)); fs.renameSync(ACC_FILE + '.tmp', ACC_FILE); }
  catch (e) { console.log('accounts.json: ' + e.message); }
}
saveAcc();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { saveAcc(); } catch (e) { } process.exit(0); });   // сохранить аккаунты при остановке/перезапуске
const NAME_RE = /^[A-Za-zА-Яа-яЁё0-9_.-]{3,16}$/;
const RESERVED = new Set(['гость', 'guest', 'admin', 'админ', 'администратор', 'система', 'system', 'zs-admin']);
const b64u = b => Buffer.from(b).toString('base64url');
function mkToken(name) {
  const p = b64u(name + '|' + (Date.now() + 30 * 864e5));
  return p + '.' + crypto.createHmac('sha256', ACC.secret).update(p).digest('hex').slice(0, 40);
}
function verifyToken(tok) {                       // -> аккаунт или null (подпись, срок, аккаунт существует)
  tok = String(tok || ''); const i = tok.indexOf('.'); if (i < 1) return null;
  const p = tok.slice(0, i), sig = tok.slice(i + 1);
  const good = crypto.createHmac('sha256', ACC.secret).update(p).digest('hex').slice(0, 40);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  let t; try { t = Buffer.from(p, 'base64url').toString('utf8').split('|'); } catch (e) { return null; }
  if (!(+t[1] > Date.now())) return null;
  return ACC.users[String(t[0]).toLowerCase()] || null;
}
// Лимиты рассчитаны на общий адрес (школа, семья, мобильный оператор): много игроков могут делить один IP.
const REG_LIMIT = +process.env.REG_LIMIT || 60;             // регистраций с одного адреса в час

/* ---------- ранги (привязаны к аккаунту) и выданные команды ---------- */
const RANK_NEED = [0, 30, 90, 190, 340, 560, 860, 1260, 1780, 2480];     // сколько убитых зомби нужно для ранга 1…10
const rankOf = k => { let r = 1; for (let i = 1; i < RANK_NEED.length; i++) if (k >= RANK_NEED[i]) r = i + 1; return r; };
const GRANTABLE = ['gg', 'tpa', 'god', 'heal', 'ammo', 'killall', 'say', 'run', 'jump', 'power', 'rapid', 'freeze'];
const userView = u => ({ kills: u.kills || 0, rank: rankOf(u.kills || 0), perms: u.perms || [] });
let accSaveT = 0;
const saveAccSoon = () => { if (accSaveT) return; accSaveT = setTimeout(() => { accSaveT = 0; saveAcc(); }, 3000); };
function addKills(u, n) { const b = rankOf(u.kills || 0); u.kills = (u.kills || 0) + n; saveAccSoon(); return rankOf(u.kills) > b; }
const KWIN = new Map();                                                    // одиночная игра: не больше 500 убийств в час на аккаунт
function authKills(req, res) {
  const u = verifyToken(req.headers['x-auth']);
  if (!u) return jsonRes(res, 401, { ok: false, err: 'auth' });
  if (u.banned) return jsonRes(res, 403, { ok: false, err: 'banned' });
  readJson(req, res, j => {
    let n = Math.min(80, Math.floor(+j.n) || 0), up = false;
    if (n > 0) {
      const now = Date.now(); let w = KWIN.get(u.name); if (!w || now - w.t > 3600000) w = { t: now, n: 0 };
      n = Math.max(0, Math.min(n, 500 - w.n)); w.n += n; KWIN.set(u.name, w);
      if (n > 0) up = addKills(u, n);
    }
    jsonRes(res, 200, Object.assign({ ok: true, up }, userView(u)));
  });
}
function pushRank(key, up) {
  const u = ACC.users[key]; if (!u) return;
  for (const c of CL.values()) if (c.acct === key) {
    c.rank = rankOf(u.kills || 0); send(c, { s: 'rank', kills: u.kills || 0, rank: c.rank, up: !!up });
    if (c.room) bcRoster(c.room);
  }
}
function pushPerms(key) { const u = ACC.users[key]; if (!u) return; for (const c of CL.values()) if (c.acct === key) send(c, { s: 'perms', list: u.perms || [] }); }

const REGS = new Map(), LFAILS = new Map(), NFAILS = new Map();
function kickAccount(key) { for (const c of [...CL.values()]) if (c.acct === key) { send(c, { s: 'kicked' }); setTimeout(() => drop(c), 250); } }
function authRegister(req, res) {
  const ip = ipOf(req), now = Date.now(), list = (REGS.get(ip) || []).filter(t => now - t < 3600000);
  if (list.length >= REG_LIMIT) return jsonRes(res, 429, { ok: false, err: 'Слишком много регистраций с вашего адреса. Попробуйте позже.' });
  readJson(req, res, j => {
    const name = String(j.name || '').trim(), pass = String(j.pass || '');
    if (!NAME_RE.test(name)) return jsonRes(res, 400, { ok: false, err: 'Имя: 3–16 символов (буквы, цифры, _ - .)' });
    if (pass.length < 6 || pass.length > 64) return jsonRes(res, 400, { ok: false, err: 'Пароль: от 6 символов' });
    const key = name.toLowerCase();
    if (RESERVED.has(key) || (ADMIN && key === String(ADMIN.login).toLowerCase())) return jsonRes(res, 400, { ok: false, err: 'Это имя зарезервировано' });
    if (ACC.users[key]) return jsonRes(res, 409, { ok: false, err: 'Такое имя уже занято' });
    const salt = crypto.randomBytes(16).toString('hex');
    ACC.users[key] = { name, salt, hash: hashPass(pass, salt), created: now, last: now, banned: false, kills: 0, perms: [] };
    saveAcc(); list.push(now); REGS.set(ip, list);
    console.log('[+] аккаунт: ' + name + '  (всего: ' + Object.keys(ACC.users).length + ')');
    jsonRes(res, 200, Object.assign({ ok: true, name, token: mkToken(name) }, userView(ACC.users[key])));
  });
}
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
function authLogin(req, res) {
  const ip = ipOf(req);
  readJson(req, res, j => {
    const nm = String(j.name || '').trim().toLowerCase(), key = ip + '|' + nm;     // блокировка по паре «адрес + имя», а не по всему адресу
    const f = LFAILS.get(key) || { n: 0, until: 0 }, g = NFAILS.get(nm) || { n: 0, until: 0 };
    if (f.until > Date.now() || g.until > Date.now()) return jsonRes(res, 429, { ok: false, err: 'Слишком много неверных попыток. Подождите 10 минут.' });
    const u = ACC.users[nm];
    const h = hashPass(String(j.pass || ''), u ? u.salt : DUMMY_SALT);          // время ответа не выдаёт, есть ли такое имя
    const good = u && crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex'));
    if (!good) {
      f.n++; if (f.n >= 10) { f.until = Date.now() + 600000; f.n = 0; } LFAILS.set(key, f);
      g.n++; if (g.n >= 60) { g.until = Date.now() + 600000; g.n = 0; } NFAILS.set(nm, g);      // подбор с многих адресов по одному имени
      return setTimeout(() => jsonRes(res, 401, { ok: false, err: u ? 'Неверный пароль' : 'Такого аккаунта нет — нажмите «Регистрация»' }), 400);
    }
    if (u.banned) return jsonRes(res, 403, { ok: false, err: 'Аккаунт заблокирован администратором' });
    LFAILS.delete(key); u.last = Date.now(); saveAcc();
    jsonRes(res, 200, Object.assign({ ok: true, name: u.name, token: mkToken(u.name) }, userView(u)));
  });
}

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

/* ---------- комнаты по городам (у каждой комнаты свой хост и до 8 игроков) ---------- */
let nid = 0;
const CL = new Map();                 // id -> соединение (клиент)
const CITIES = [['Грозный', 3], ['Аргун', 2], ['Гудермес', 2], ['Урус-Мартан', 3], ['Шали', 2], ['Ачхой-Мартан', 1],
                ['Курчалой', 1], ['Наур', 1], ['Ойсхар', 1], ['Серноводск', 1], ['ст. Шелковская', 1]];
const ROOMS = new Map();              // id -> комната
const ROOM_LIST = [];
{ let k = 0;
  for (const [city, cnt] of CITIES) for (let n = 1; n <= cnt; n++) {
    const r = { id: 'r' + (++k), city, n, hostId: null, busy: false, mode: 'coop', members: new Map(), dead: new Set() };
    ROOMS.set(r.id, r); ROOM_LIST.push(r);
  } }
const joined = r => [...r.members.values()].filter(c => c.name != null).length;
const totalJoined = () => [...CL.values()].filter(c => c.name != null).length;
const plainName = n => String(n).replace(/^\u{1F451}\s*/u, '');
const roomName = r => r.city + ', комната ' + r.n;

function uniq(name, room) {
  let n = String(name || 'Игрок').replace(/[^\wа-яА-ЯёЁ \-.]/g, '').trim().slice(0, 16) || 'Игрок';
  const used = new Set([...room.members.values()].map(c => c.name)), base = n;
  for (let i = 2; used.has(n); i++) n = base.slice(0, 13) + ' ' + i;
  return n;
}
function roster(room) {
  return { s: 'players', host: room.hostId, list: [...room.members.values()].filter(c => c.name != null).map(c => ({ id: c.id, name: c.name, admin: !!c.admin, rank: c.rank || 1 })) };
}
function bcRoster(room) {
  const t = JSON.stringify(roster(room));
  for (const c of room.members.values()) if (c.name != null) send(c, t);
}
function roomsInfo() {
  return {
    max: MAXP, rooms: ROOM_LIST.length, capacity: ROOM_LIST.length * MAXP, online: totalJoined(),
    adminOnline: ROOM_LIST.some(r => [...r.members.values()].some(c => c.admin)) || (SESS.size > 0 && Date.now() - adminSeen < 15 * 60 * 1000),
    cities: CITIES.map(([city]) => ({
      name: city,
      rooms: ROOM_LIST.filter(r => r.city === city).map(r => ({ id: r.id, n: r.n, players: joined(r), host: r.hostId != null, busy: r.busy, mode: r.mode, admin: [...r.members.values()].some(c => c.admin) }))
    }))
  };
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
  const room = c.room;
  if (!room || c.name == null) return;
  room.members.delete(c.id);
  console.log('[-] вышел: ' + c.name + '  (' + roomName(room) + ')');
  if (c.id === room.hostId) {                              // хост ушёл — эта комната закрывается (остальные работают)
    room.hostId = null; room.busy = false; room.mode = 'coop'; room.dead.clear();
    const rest = [...room.members.values()];
    room.members.clear();
    for (const o of rest) { if (o.name != null) send(o, { s: 'hostgone' }); o.room = null; o.name = null; }
    setTimeout(() => rest.forEach(o => { try { o.sock.end(); } catch (e) { } }), 300);
    console.log('[!] хост вышел, комната «' + roomName(room) + '» закрыта. Можно создать новую.');
  } else bcRoster(room);
}

function onMsg(c, txt) {
  if (txt.length > 200000) return;
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;

  if (m.s === 'host' || m.s === 'join') {
    if (c.name != null) return;
    const acc = verifyToken(m.auth);
    if (!acc) return send(c, { s: 'err', code: 'auth' });
    if (acc.banned) return send(c, { s: 'err', code: 'banned' });
    const key = acc.name.toLowerCase();
    for (const o of [...CL.values()]) if (o !== c && o.acct === key) { send(o, { s: 'replaced' }); drop(o); }   // один аккаунт — одно подключение
    const room = ROOMS.get(String(m.room));
    if (!room) return send(c, { s: 'err', code: 'badroom' });
    if (m.s === 'join' && room.mode !== 'duel' && room.dead.has(key)) return send(c, { s: 'err', code: 'dead' });   // погибший не может перезайти до следующего уровня
    if (m.s === 'host' && room.hostId != null) return send(c, { s: 'err', code: 'hostexists' });
    if (m.s === 'join' && room.hostId == null) return send(c, { s: 'err', code: 'nohost' });
    if (joined(room) >= MAXP) return send(c, { s: 'err', code: 'full' });
    c.room = room; room.members.set(c.id, c);
    c.acct = key; c.name = acc.name; c.rank = rankOf(acc.kills || 0);
    const adm = m.token ? sessOk(m.token) : null;
    if (m.token && !adm) send(c, { s: 'adminfail' });
    if (adm) { c.admin = true; c.name = '👑 ' + c.name; adminSeen = Date.now(); }
    if (m.s === 'host') { room.hostId = c.id; room.busy = false; room.mode = m.mode === 'duel' ? 'duel' : 'coop'; }
    send(c, { s: 'welcome', id: c.id, name: c.name, room: room.id, roomName: roomName(room), kills: acc.kills || 0, rank: c.rank, perms: acc.perms || [] });
    bcRoster(room);
    if (adm) { for (const o of room.members.values()) if (o !== c && o.name != null) send(o, { s: 'adm', text: '👑 Администратор ' + plainName(c.name) + ' вошёл в комнату' }); }
    console.log((m.s === 'host' ? '[+] ХОСТ: ' : '[+] игрок: ') + c.name + '  → ' + roomName(room) + '  (в комнате: ' + joined(room) + ', онлайн: ' + totalJoined() + ')');
    return;
  }
  if (c.name == null || !c.room) return;
  const room = c.room;
  if (m.s === 'kills' && c.id === room.hostId && m.d && typeof m.d === 'object' && room.mode !== 'duel') {
    const now = Date.now(); if (!room.kw || now - room.kw.t > 30000) room.kw = { t: now, n: 0 };
    for (const id of Object.keys(m.d).slice(0, 10)) {
      const o = room.members.get(+id), u = o && ACC.users[o.acct]; let n = Math.floor(+m.d[id]);
      if (!u || !(n > 0)) continue; n = Math.min(n, 40); if (room.kw.n + n > 150) break; room.kw.n += n;     // защита от накрутки: не больше 150 убийств за 30 секунд на комнату
      const up = addKills(u, n); o.rank = rankOf(u.kills);
      send(o, { s: 'rank', kills: u.kills, rank: o.rank, up });
      if (up) { bcRoster(room); for (const x of room.members.values()) send(x, { s: 'rankup', name: o.name, rank: o.rank }); }
    }
    return;
  }
  if (m.s === 'say' && (c.admin || ((ACC.users[c.acct] || {}).perms || []).includes('say'))) { const text = String(m.text || '').trim().slice(0, 200); if (text) { const out = JSON.stringify({ s: 'say', name: plainName(c.name), text }); for (const o of room.members.values()) send(o, out); } return; }
  if (m.s === 'm' && m.m && typeof m.m === 'object') {
    if (c.id === room.hostId) {                            // по сообщениям хоста знаем, идёт ли игра
      const t = m.m.t;
      if (t === 'start') { room.busy = true; if (m.m.mode === 'duel') room.mode = 'duel'; }
      else if (t === 'over' || t === 'duelend') room.busy = false;
      if (m.to === 'all' && (t === 'lvl' || t === 'start' || t === 'over' || t === 'duelend')) room.dead.clear();      // новый уровень — все воскресают
    } else if (m.m.t === 'dead' && room.mode !== 'duel') room.dead.add(c.acct);
    const out = JSON.stringify({ s: 'm', f: c.id, m: m.m });
    if (m.to === 'all') { for (const o of room.members.values()) if (o !== c && o.name != null) send(o, out); }
    else {
      const o = room.members.get(m.to === 'host' ? room.hostId : +m.to);
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
    return res.end(JSON.stringify({ ips: lanIps(), port: PORT, players: totalJoined(), rooms: ROOM_LIST.length, httpsPort: secure ? HTTPS_PORT : null }));
  }
  if (u === '/rooms') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(roomsInfo()));
  }
  if (u === '/site') return jsonRes(res, 200, { announce: SITE.announce || '' });
  if (u === '/auth/info') return jsonRes(res, 200, { ok: true, accounts: Object.keys(ACC.users).length });
  if (u === '/auth/register' && req.method === 'POST') return authRegister(req, res);
  if (u === '/auth/login' && req.method === 'POST') return authLogin(req, res);
  if (u === '/auth/kills' && req.method === 'POST') return authKills(req, res);
  if (u === '/auth/me') { const a = verifyToken(req.headers['x-auth']); return a && !a.banned ? jsonRes(res, 200, Object.assign({ ok: true, name: a.name }, userView(a))) : jsonRes(res, 401, { ok: false }); }
  if (u === '/admin' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' }); return res.end(ADMIN_HTML); }
  if (u === '/admin/login' && req.method === 'POST') return adminLoginRoute(req, res);
  if (u === '/admin/api' && req.method === 'POST') return adminApi(req, res);
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
  console.log(ADMIN ? 'Админ: включён (' + ADMIN_SRC + '). Панель: /admin' : 'Админ: НЕ настроен (создайте: node server.js setadmin ЛОГИН ПАРОЛЬ).');
  console.log('Комнат: ' + ROOM_LIST.length + ' (городов: ' + CITIES.length + '), в каждой до ' + MAXP + ' игроков — всего до ' + ROOM_LIST.length * MAXP + '.\n');
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
