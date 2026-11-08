const core = require('../../core/app-core.js');
const {E, env, svgSrc} = core;
const TIPS = ['筹码健康。可以正常开池、跟注、打翻牌后。', '开始失去投机牌的价值。少跟注，多主动加注偷盲。', '加注后再弃牌代价很高。考虑 3bet 全下和小尺度开池。', '只剩推弃。第一个入池就全下，不要平跟。'];

Page({
  data: {m: {stack: 18000, sb: 600, bb: 1200, ante: 1200}},
  onLoad() { core.reg('map', this); this.draw(); this.calc(); },
  onUnload() { core.unreg('map', this); },
  onShow() { this.refreshBanner(); },
  refreshBanner() { this.setData({banner: core.bannerText('map')}); },
  draw() {
    const s = E.STAGES[E.stageSel];
    E.drawChart();
    this.setData({stages: E.STAGES.map((x, i) => ({k: x.k, lv: x.lv, bb: x.bb, on: i === E.stageSel})), stage: s, chart: svgSrc(env.document.getElementById('depthChart').innerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))});
  },
  onStage(e) {
    const i = +e.currentTarget.dataset.i;
    E.stageSel = i; E.ls.set('stage', i);
    if (!E.P.visit.stages.includes(i)) { E.P.visit.stages.push(i); E.visited(); }
    this.draw();
  },
  onM(e) {
    this.setData({['m.' + e.currentTarget.dataset.k]: e.detail.value});
    this.calc();
    if (!E.P.visit.mcalc) { E.P.visit.mcalc = true; E.visited(); }
  },
  calc() {
    const m = this.data.m, st = +m.stack || 0, sb = +m.sb || 0, bb = Math.max(1, +m.bb || 1), an = +m.ante || 0;
    const orbit = sb + bb + an, M = st / orbit, zi = E.zoneOf(M), z = E.ZONES[zi];
    this.setData({out: {rows: [['折合大盲', (st / bb).toFixed(1) + ' BB'], ['每圈成本（小盲+大盲+前注）', E.fmt(orbit)], ['M 值（能撑几圈）', M.toFixed(1)]], zone: z.n, color: z.c, tip: TIPS[zi]}});
  },
});
