// What the shared web code expects from a browser, rebuilt for the mini program.
// document.createElement returns a small element that can be turned back into an
// HTML string (el.outerHTML) and shown with <rich-text>. Elements looked up by id
// are placeholders, so web-only DOM writes inside shared code do nothing.
const UI = {};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

class ClassList {
  constructor(el) { this.el = el; }
  get list() { return this.el.className.split(/\s+/).filter(Boolean); }
  add(...c) { const l = this.list; c.forEach(x => { if (!l.includes(x)) l.push(x); }); this.el.className = l.join(' '); }
  remove(...c) { this.el.className = this.list.filter(x => !c.includes(x)).join(' '); }
  contains(c) { return this.list.includes(c); }
  toggle(c, f) { const want = f === undefined ? !this.contains(c) : !!f; if (want) this.add(c); else this.remove(c); return want; }
}

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.className = ''; this.style = {}; this.dataset = {}; this.attrs = {}; this.kids = [];
    this.hidden = false; this.id = ''; this.value = ''; this.checked = false; this.disabled = false;
    this.scrollTop = 0; this.scrollHeight = 0;
    this.classList = new ClassList(this);
  }
  set innerHTML(h) { this.kids = h === '' || h == null ? [] : [{raw: String(h)}]; }
  get innerHTML() { return this.kids.map(k => k instanceof El ? k.outerHTML : k.raw != null ? k.raw : esc(k.text)).join(''); }
  set textContent(t) { this.kids = t === '' || t == null ? [] : [{text: String(t)}]; }
  get textContent() { return unesc(this.innerHTML.replace(/<[^>]*>/g, '')); }
  get innerText() { return unesc(this.innerHTML.replace(/<\/(p|div|li)>/g, '\n').replace(/<[^>]*>/g, '')).trim(); }
  set title(t) { this.attrs.title = t; }
  get title() { return this.attrs.title || ''; }
  get children() { return this.kids.filter(k => k instanceof El); }
  appendChild(c) { this.kids.push(c); return c; }
  append(...cs) { cs.forEach(c => this.kids.push(c instanceof El ? c : {text: String(c)})); }
  prepend(c) { this.kids.unshift(c instanceof El ? c : {text: String(c)}); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  querySelector() { return new El('div'); }
  querySelectorAll() { return []; }
  addEventListener() {} removeEventListener() {} focus() {} scrollIntoView() {} remove() {}
  get outerHTML() {
    const t = this.tagName.toLowerCase();
    let a = '';
    if (this.className) a += ` class="${esc(this.className)}"`;
    const st = Object.keys(this.style).filter(k => this.style[k] !== '' && this.style[k] != null).map(k => `${kebab(k)}:${this.style[k]}`);
    if (this.hidden) st.push('display:none');
    if (st.length) a += ` style="${esc(st.join(';'))}"`;
    Object.keys(this.attrs).forEach(k => { a += ` ${k}="${esc(this.attrs[k])}"`; });
    return `<${t}${a}>${this.innerHTML}</${t}>`;
  }
}

const byId = {};
const document = {
  createElement: t => new El(t),
  getElementById: id => byId[id] || (byId[id] = Object.assign(new El('div'), {id})),
  querySelector: () => null,
  querySelectorAll: () => [],
  title: '',
};

const storage = {
  getItem(k) { try { const v = wx.getStorageSync(k); return v === '' || v == null ? null : String(v); } catch (e) { return null; } },
  setItem(k, v) { try { wx.setStorageSync(k, String(v)); } catch (e) {} },
  removeItem(k) { try { wx.removeStorageSync(k); } catch (e) {} },
};

module.exports = {
  UI, El, esc,
  document,
  localStorage: storage,
  matchMedia: () => ({matches: false}),
  window: {},
  location: {hash: '', protocol: 'wxapp:'},
  html: els => (Array.isArray(els) ? els : [els]).map(e => e instanceof El ? e.outerHTML : String(e)).join(''),
};
