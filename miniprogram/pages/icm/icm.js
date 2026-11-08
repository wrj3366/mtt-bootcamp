const core = require('../../core/app-core.js');
const {E} = core;
const PRESETS = [{id: 'icmPreset1', l: '均匀筹码', v: [25000, 25000, 25000, 25000]}, {id: 'icmPreset2', l: '一个大码 + 一个短码', v: [25000, 45000, 25000, 5000]}, {id: 'icmPreset3', l: '你是中码', v: [25000, 40000, 30000, 5000]}];

Page({
  data: {pay: [50, 30, 20], vil: 0, vilL: ['玩家 B', '玩家 C', '玩家 D'], presets: PRESETS.map(p => ({id: p.id, l: p.l}))},
  onLoad() { core.reg('icm', this); this.stacks = E.ls.get('icm', [30000, 25000, 25000, 20000]).slice(); this.draw(); },
  onUnload() { core.unreg('icm', this); },
  onShow() { this.refreshBanner(); },
  refreshBanner() { this.setData({banner: core.bannerText('icm')}); },
  onSlide(e) { const i = +e.currentTarget.dataset.i; this.stacks[i] = +e.detail.value; E.ls.set('icm', this.stacks); this.draw(); },
  onPay(e) { this.setData({['pay[' + e.currentTarget.dataset.i + ']']: +e.detail.value || 0}); this.draw(); },
  onVil(e) { this.setData({vil: +e.detail.value}); this.draw(); },
  onPreset(e) {
    const p = PRESETS[+e.currentTarget.dataset.i];
    this.stacks = p.v.slice(); E.ls.set('icm', this.stacks);
    if (!E.P.visit.icm.includes(p.id)) { E.P.visit.icm.push(p.id); E.visited(); }
    this.draw();
  },
  draw() {
    const st = this.stacks, pay = this.data.pay, tot = st.reduce((a, b) => a + b, 0), pt = pay.reduce((a, b) => a + b, 0) || 1, eq = E.icm(st, pay);
    const mx = Math.max(...st.map(s => s / tot * 100), ...eq.map(e => e / pt * 100));
    const players = st.map((s, i) => {
      const c = s / tot * 100, e = eq[i] / pt * 100;
      return {n: E.NAMES[i], s, sl: E.fmt(s), cw: c / mx * 100, ew: e / mx * 100, txt: `筹码 ${c.toFixed(1)}% → 奖金 ${e.toFixed(1)}%`, d: (e > c ? '+' : '') + (e - c).toFixed(1), up: e > c};
    });
    const v = this.data.vil + 1, r = E.icmCall(st, pay, v);
    this.setData({players, call: {rows: [['输赢的筹码', E.fmt(r.risk)], ['弃牌：你的奖金权益', r.now.toFixed(1) + '%'], ['跟注赢了', r.ew.toFixed(1) + '%'], ['跟注输了', r.el.toFixed(1) + '%'], ['只看筹码需要胜率', '50%']],
      need: r.need.toFixed(1) + '%', bf: r.bf.toFixed(2), cover: st[v] >= st[0]}});
  },
});
