// Connects the shared engine (generated from index.html) to the mini program pages.
const env = require('./env.js');
const E = require('./engine.js');
const {UI, El, html} = env;

// pages register themselves so engine callbacks reach the one that is open
const pages = {};
const reg = (name, page) => { pages[name] = page; };
const unreg = (name, page) => { if (pages[name] === page) delete pages[name]; };
const call = (name, fn, ...a) => { const p = pages[name]; if (p && p[fn]) return p[fn](...a); };

UI.toast = t => wx.showToast({title: String(t), icon: 'none', duration: 2600});
UI.renderBanner = () => Object.keys(pages).forEach(k => call(k, 'refreshBanner'));
UI.renderSim = () => call('sim', 'renderTable');
UI.renderActions = () => call('sim', 'renderActions');
UI.showCoach = rec => call('sim', 'showCoach', rec);
UI.showSimEnd = () => call('sim', 'showEnd');
UI.openSimPlay = () => call('sim', 'openPlay');
UI.renderScnPick = () => call('sim', 'showPick');
UI.pushSync = () => {};
// shared code calls aiThread(el, ...) with a placeholder element; its id names the <aithread> component
UI.aiThread = (el, sys, first, opts) => {
  const id = el && el.id;
  for (const k of Object.keys(pages)) {
    const c = id && pages[k].selectComponent && pages[k].selectComponent('#' + id);
    if (c) return c.start(sys, first, opts);
  }
};
UI.aiChat = aiChat;

function aiChat(messages, {max = 700, timeout = 40000} = {}) {
  const c = E.AI.cfg;
  if (!c.base || !c.model) return Promise.reject(new Error('请先在“工具 → AI 设置”里填写接口地址和模型'));
  if (!c.key && !E.isLocalBase(c.base)) return Promise.reject(new Error('请先在“工具 → AI 设置”里填写 API Key'));
  const header = {'Content-Type': 'application/json'};
  if (c.key) header.Authorization = 'Bearer ' + c.key;
  return new Promise((resolve, reject) => {
    wx.request({
      url: c.base.replace(/\/+$/, '') + '/chat/completions', method: 'POST', timeout, header,
      data: {model: c.model, messages, max_tokens: max, temperature: 0.6, stream: false},
      success(r) {
        let j = r.data;
        if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return reject(new Error(`接口返回了无法解析的内容（HTTP ${r.statusCode}）`)); } }
        if (r.statusCode >= 400) {
          const m = j && j.error && (j.error.message || j.error);
          return reject(new Error(`HTTP ${r.statusCode}：${typeof m === 'string' ? m : JSON.stringify(j).slice(0, 160)}`));
        }
        const out = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!out) return reject(new Error('接口没有返回内容'));
        resolve(String(out).trim());
      },
      fail(e) {
        const m = (e && e.errMsg) || '';
        if (/domain list|合法域名|not in domain/i.test(m)) reject(new Error('这个接口地址还不在小程序的合法域名里。到微信公众平台“开发管理 → 开发设置 → 服务器域名”添加，或在手机调试 / 开发者工具里打开“不校验合法域名”。'));
        else if (/timeout/i.test(m)) reject(new Error('请求超时'));
        else reject(new Error('请求失败：' + m));
      },
    });
  });
}

function setTrack(k) {
  if (!E.TRACKS[k]) k = 'mtt';
  E.track = k; E.ls.set('track', k);
  E.LESSONS = E.TRACKS[k].lessons; E.CURX = E.TRACKS[k].curr; E.viewId = null;
  if (!E.TRACK_DRILLS[k].includes(E.D.id)) { E.D.id = E.TRACK_DRILLS[k][0]; E.D.f = null; E.D.spot = null; }
}
setTrack(E.track);

// text banner shown on practice pages: progress of the current lesson's matching tasks
function bannerText(tab) {
  const A = E.activeLesson();
  if (!A) return null;
  const rel = A.tasks.map((t, i) => ({t, i})).filter(({t}) =>
    (tab === 'drill' && t.t === 'drill' && t.d === E.D.id) || (tab === 'run' && t.t === 'run') || (tab === 'sim' && t.t === 'sim') ||
    (tab === 'map' && t.t === 'visit' && t.k !== 'icm') || (tab === 'icm' && t.t === 'visit' && t.k === 'icm'));
  const parts = rel.map(({t, i}) => { const p = E.taskProgress(A, i); return (E.taskOk(A, i) ? '✓ ' : '') + (t.t === 'drill' && t.f ? E.fLabel(t.f) + ' · ' : '') + (p ? p.txt : ''); }).join('；');
  return {id: A.id, title: `第 ${A.idx + 1} 课 · ${A.t}`, txt: parts || '这个练习不在本课任务里，可以自由练', rel: rel.length > 0};
}

// SVG strings become images: <image src="{{svgSrc(svg)}}">
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64(bin) {
  let o = '';
  for (let i = 0; i < bin.length; i += 3) {
    const a = bin.charCodeAt(i), b = bin.charCodeAt(i + 1), c = bin.charCodeAt(i + 2);
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bin.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bin.length ? B64[n & 63] : '=');
  }
  return o;
}
const svgSrc = svg => 'data:image/svg+xml;base64,' + b64(unescape(encodeURIComponent(svg.replace(/font-family="[^"]*"/g, ''))));

const stripTags = s => String(s).replace(/<\/(p|div|li)>/g, '\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n{2,}/g, '\n').trim();

// rich-text does not apply descendant selectors, so give paragraphs and lists their own class
const rt = h => String(h).replace(/<p class="/g, '<p class="pp ').replace(/<p(?=[\s>])(?![^>]*class=)/g, '<p class="pp"').replace(/<ul>/g, '<ul class="ul">').replace(/<li>/g, '<li class="li">');

module.exports = {E, env, El, html, rt, reg, unreg, setTrack, bannerText, svgSrc, stripTags, aiChat};
