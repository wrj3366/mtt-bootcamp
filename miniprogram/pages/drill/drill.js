const core = require('../../core/app-core.js');
const {E, env, html, rt, stripTags} = core;
const D = E.D;

Page({
  data: {},
  onLoad() { core.reg('drill', this); },
  onUnload() { core.unreg('drill', this); },
  onShow() {
    const req = getApp().globalData.drillReq;
    getApp().globalData.drillReq = null;
    if (req) return this.open(req.d, req.f);
    if (!E.TRACK_DRILLS[E.track].includes(D.id)) { D.id = E.TRACK_DRILLS[E.track][0]; D.f = null; D.spot = null; }
    if (!D.spot || this.shownId !== D.id) this.newSpot(); else { this.chips(); this.refreshBanner(); }
  },
  open(id, f) { D.id = id; D.f = f; this.newSpot(); },
  chips() {
    this.setData({chips: E.TRACK_DRILLS[E.track].map(id => ({id, name: E.DRILLS[id].name, on: id === D.id})), scrollId: 'c-' + D.id});
  },
  refreshBanner() { this.setData({banner: core.bannerText('drill')}); },
  stats() {
    const s = E.P.stats[D.id] || {n: 0, ok: 0, streak: 0};
    this.setData({st: {n: s.n, acc: s.n ? Math.round(s.ok / s.n * 100) + '%' : '—', streak: s.streak}});
  },
  onChip(e) {
    const id = e.currentTarget.dataset.id, A = E.activeLesson();
    const t = A && A.tasks.find((t, i) => t.t === 'drill' && t.d === id && !E.taskOk(A, i));
    this.open(id, t ? t.f || null : null);
  },
  onClearFilter() { D.f = null; this.newSpot(); },
  newSpot() {
    const X = E.DRILLS[D.id];
    D.spot = X.gen(D.f); D.done = false; this.shownId = D.id;
    const views = X.view(D.spot);
    this.visualText = views.map(v => v.innerText).join('\n');
    this.setData({
      kind: X.kind, q: X.q(D.spot), filter: D.f ? E.fLabel(D.f) : '', visual: rt(html(views)),
      opts: X.opts(D.spot).map(o => ({l: o.l, v: o.v, c: o.c || 'fold'})),
      verdict: {cls: '', tag: '提示', html: rt(`<p>${X.help}</p>`)}, grid: null, done: false, aiBtn: false,
    });
    const ai = this.selectComponent('#dAI'); if (ai) ai.clear();
    this.chips(); this.stats(); this.refreshBanner();
    wx.pageScrollTo({scrollTop: 0, duration: 0});
  },
  onAnswer(e) {
    if (D.done) return;
    D.done = true;
    const i = +e.currentTarget.dataset.i, v = this.data.opts[i].v;
    const r = E.DRILLS[D.id].judge(D.spot, v), correct = r.res !== 'no';
    const tag = r.res === 'ok' ? '正确' : r.res === 'mid' ? (r.midTxt || '边缘情况：两种都算对') : '再想想';
    let grid = null;
    if (r.grid) {
      const g = env.document.createElement('div'); g.className = 'hgrid';
      E.renderGrid(g, r.grid.pct, r.grid.map, r.grid.key, r.grid.fn);
      g.children.forEach(c => { c.className = ('hc ' + c.className).trim(); }); // WXSS tag selectors do not reach rich-text nodes
      grid = {html: g.outerHTML, title: r.grid.title, lbl: r.grid.lbl, edge: !r.grid.fn, two: !!r.grid.two, inLbl: r.grid.inLbl || '在范围内', callLbl: r.grid.callLbl || '跟注'};
    }
    this.pick = this.data.opts[i].l;
    this.setData({verdict: {cls: r.res, tag, html: rt(r.html)}, grid, done: true, aiBtn: true});
    E.recordDrill(D.id, D.spot, correct);
    this.stats();
  },
  onAI() {
    this.setData({aiBtn: false});
    const v = this.data.verdict;
    const ctx = `练习：${E.DRILLS[D.id].name}（${this.data.kind}）\n题目：${this.data.q}\n题目信息：${this.visualText.replace(/\n+/g, '；')}\n学生的选择：${this.pick}\n系统判断与讲解：${v.tag} ${stripTags(v.html).replace(/\n+/g, ' ')}\n\n请讲解这道题：为什么这样判断，背后的概念是什么。`;
    this.selectComponent('#dAI').start(E.track === 'cash' ? E.COACH_SYS_CASH : E.COACH_SYS, ctx);
  },
  onBanner() {
    if (this.data.banner) wx.navigateTo({url: '/pages/lesson/lesson?id=' + this.data.banner.id});
  },
});
