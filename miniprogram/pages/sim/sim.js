// Simulator: the table, betting and coach come from the shared engine; this page draws them.
const core = require('../../core/app-core.js');
const {E, env, El, svgSrc} = core;
const esc = env.esc;
const $ = id => env.document.getElementById(id);

const PICK = {
  field: [18, 45, 90, 180], fieldL: ['18 人（2 桌）', '45 人（5 桌）', '90 人（10 桌）', '180 人（20 桌）'],
  bb: [100, 50], bbL: ['100 BB（标准）', '50 BB（短筹码）'],
  hpl: [12, 8, 5], hplL: ['标准（每级 12 手）', '快速（每级 8 手）', '极速（每级 5 手）'],
  hands: [50, 100, 200, 0], handsL: ['50 手', '100 手', '200 手', '不限，自己决定何时离桌'],
  mix: ['bal', 'fish', 'reg'], mixL: ['均衡', '鱼多（跟注站多）', '常客多（标准、松凶多）'],
};
const idx = (arr, v, d) => { const i = arr.indexOf(v); return i < 0 ? d : i; };
const today = () => { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

Page({
  data: {view: 'pick', PICK, coach: {type: 'intro'}, act: {mode: 'wait', txt: ''}},
  onLoad() { core.reg('sim', this); },
  onUnload() { core.unreg('sim', this); },
  onShow() {
    if (E.G && !E.G.ended) { if (this.data.view !== 'play') this.setData({view: 'play'}); this.renderTable(); }
    else if (this.data.view !== 'end') this.showPick();
    this.refreshBanner();
  },
  refreshBanner() { const b = core.bannerText('sim'); this.setData({banner: b && b.rel ? b : null}); },
  clearAI(ids) { ids.forEach(id => { const c = this.selectComponent('#' + id); if (c) c.clear(); }); },

  /* ---------- pick a game ---------- */
  showPick() {
    const sv = E.ls.get('simSave', null), mc = Object.assign({field: 45, bb: 100, hpl: 12}, E.ls.get('mttCfg', {}));
    let mttSave = '';
    if (sv) { const h = sv.seats.find(q => q && q.isHero); mttSave = `${sv.cfg.field} 人锦标赛 · 已打 ${sv.played} 手 · 剩余 ${sv.field} 人 · 你有 ${h ? Math.round(h.stack / E.lvAt(sv.lvl)[1]) : 0} BB · 盲注 ${E.lvAt(sv.lvl).join('/')}`; }
    const cs = E.ls.get('cashSave', null), cc = Object.assign({hands: 100, mix: 'bal', topup: true}, E.ls.get('cashCfg', {}));
    let cashSave = '';
    if (cs) { const h = cs.seats.find(q => q && q.isHero), net = h ? (h.stack - cs.buyin) / E.CASH_BB : 0; cashSave = `已打 ${cs.played} 手 · 盈亏 ${E.sgn1(net)} BB · 你面前有 ${h ? Math.round(h.stack / E.CASH_BB) : 0} BB`; }
    const scns = Object.keys(E.SCN).map(k => { const s = E.SCN[k]; return {k, n: s.n, sub: s.sub, desc: s.desc, len: s.end === 'itm' ? '打到进钱圈为止，最多 ' + s.hands + ' 手' : s.hands + ' 手'}; });
    const hist = (E.P.sim || []).slice(-8).reverse().map(x => ({t: `${x.date} · ${x.name || (E.SCN[x.key] ? E.SCN[x.key].n : x.key)} · ${x.res}`, acc: x.acc}));
    this.setData({
      view: 'pick', cashFirst: E.track === 'cash', mttSave, cashSave, scns, hist,
      mi: {field: idx(PICK.field, mc.field, 1), bb: idx(PICK.bb, mc.bb, 0), hpl: idx(PICK.hpl, mc.hpl, 0)},
      ci: {hands: idx(PICK.hands, cc.hands, 1), mix: idx(PICK.mix, cc.mix, 0), topup: !!cc.topup},
    });
  },
  onPick(e) { this.setData({[e.currentTarget.dataset.k]: +e.detail.value}); },
  onTopup(e) { this.setData({'ci.topup': e.detail.value}); },
  onMttStart() {
    const m = this.data.mi, cfg = {field: PICK.field[m.field], bb: PICK.bb[m.bb], hpl: PICK.hpl[m.hpl]};
    E.ls.set('mttCfg', cfg); E.startSim('mtt', cfg);
  },
  onCashStart() {
    const c = this.data.ci, cfg = {hands: PICK.hands[c.hands], mix: PICK.mix[c.mix], topup: c.topup};
    E.ls.set('cashCfg', cfg); E.startSim('cash', cfg);
  },
  onResume(e) { E.resumeSim(e.currentTarget.dataset.m); },
  onDrop(e) {
    const m = e.currentTarget.dataset.m;
    wx.showModal({title: '放弃这场？', content: '存档会被删除，不能恢复。', confirmText: '放弃', success: r => { if (r.confirm) { E.ls.set(m === 'cash' ? 'cashSave' : 'simSave', null); this.showPick(); } }});
  },
  onScn(e) { E.startSim(e.currentTarget.dataset.k); },

  /* ---------- table ---------- */
  openPlay() {
    this.lastAk = null;
    this.setData({view: 'play', coach: {type: 'intro'}, log: [], act: {mode: 'wait', txt: '发牌中…'}});
    this.clearAI(['hintAI', 'coachAI']);
    wx.pageScrollTo({scrollTop: 0, duration: 0});
  },
  renderTable() {
    const G = E.G, H = E.H;
    if (!G || !H) return;
    const T = new El('div'); T.className = 'simtable'; T.innerHTML = '<div class="sim-oval"></div>';
    for (let s = 0; s < G.N; s++) {
      const p = G.seats[s];
      if (!p) continue;
      const ang = Math.PI / 2 + (s - E.SIM_HERO) * 2 * Math.PI / G.N, x = 50 + 41 * Math.cos(ang), y = 50 + 40 * Math.sin(ang);
      const el = new El('div');
      el.className = 'pseat' + (p.isHero ? ' me' : '') + (p.folded ? ' fold' : '') + (H.actor === p ? ' act' : '') + (p.thinking ? ' think' : '');
      el.style.left = x.toFixed(1) + '%'; el.style.top = y.toFixed(1) + '%';
      const show = p.isHero || (H.reveal && !p.folded);
      let cards = '';
      if (p.cards && !p.folded) cards = p.cards.map(c => { const ce = E.cardEl(show ? c : null, {sm: true, back: !show}); ce.classList.add(p.isHero ? 'hero' : 'xs'); return ce.outerHTML; }).join('');
      el.innerHTML = `<div class="ptop"><span class="ppos">${p.pos}</span><span class="pname">${esc(p.isHero ? '你' : p.name)}</span></div><div class="pstk">${E.fBB(p.stack)}</div>${!p.isHero && E.simOpt.showStyle ? `<div class="psty">${E.STYLES[p.style].n}</div>` : ''}<div class="pcards">${cards}</div>${p.thinking ? '<div class="psty">AI 思考中…</div>' : ''}`;
      T.appendChild(el);
      if (p.bet > 0) { const b = new El('div'); b.className = 'pbet'; b.style.left = (x + (50 - x) * .42).toFixed(1) + '%'; b.style.top = (y + (50 - y) * .42).toFixed(1) + '%'; b.textContent = E.fBB(p.bet); T.appendChild(b); }
      if (s === G.btn) { const d = new El('div'); d.className = 'dbtn'; d.textContent = 'D'; d.style.left = (x + (50 - x) * .3).toFixed(1) + '%'; d.style.top = (y + (50 - y) * .3).toFixed(1) + '%'; T.appendChild(d); }
    }
    const board = [0, 1, 2, 3, 4].map(i => E.cardEl(H.board[i] || null, {sm: true}).outerHTML).join('');
    T.innerHTML += `<div class="sim-center"><div class="cards">${board}</div><div class="pot">底池 ${E.fBB(E.potNow())}</div></div>`;
    const log = H.acts.slice();
    this.setData({table: T.outerHTML, log, logEnd: 'lg' + (log.length - 1)});
    this.renderStatus();
    this.renderActions();
  },
  renderStatus() {
    const G = E.G, d = G.decisions, good = d.filter(x => x.res !== 'no').length, mtt = G.mode === 'mtt', cash = G.mode === 'cash';
    let rows;
    if (cash) {
      const cs = G.cs, n = cs.hands, net = cs.curve.length ? cs.curve[cs.curve.length - 1] : 0;
      rows = [['盲注', '0.5 / 1 BB（固定，无前注）'], ['已打手数', `${G.played}${G.S.hands < 1e9 ? ' / ' + G.S.hands : ''}`], ['盈亏', E.sgn1(net) + ' BB'], ['bb/100', n ? E.sgn1(net / n * 100) : '—'], ['入池率 VPIP', n ? Math.round(cs.vpip / n * 100) + '%' : '—'], ['翻牌前加注率 PFR', n ? Math.round(cs.pfr / n * 100) + '%' : '—'], ['总买入', `${Math.round(G.buyin / E.CASH_BB)} BB${G.rebuys ? ` · 输光重买 ${G.rebuys} 次` : ''}`]];
    } else {
      const [sb, bb] = E.lvAt(G.lvl), nx = G.S.hpl - (G.played % G.S.hpl);
      rows = [['盲注 / 前注', `${sb}/${bb} · ${bb}（${nx} 手后升级）`], ['剩余人数', `${G.field}${mtt ? ' / ' + G.S.field : ''} 人 · 前 ${G.paid} 名有奖金`]];
      if (mtt) rows.push(['平均筹码', E.fBB(G.total / G.field)], ['你的排名', E.rankText()], ['奖金', `进圈 ¥${E.money(G.paid)} · 冠军 ¥${E.money(1)}`], ['已打手数', String(G.played)]);
      else rows.push(['已打手数', `${G.played}/${G.S.hands}${G.rebuys ? ` · 重新坐下 ${G.rebuys} 次` : ''}`]);
    }
    rows.push(['决策正确率', d.length ? `${Math.round(good / d.length * 100)}%（${good}/${d.length}）` : '—']);
    this.setData({status: {title: G.S.n, phase: E.PHASE_CN[E.phase()], rows, mode: G.mode, auto: E.simOpt.auto, fast: E.simOpt.speed === 'fast', style: E.simOpt.showStyle, topup: !!(G.cfg && G.cfg.topup)}});
  },
  renderActions() {
    const G = E.G, H = E.H;
    if (!G) return;
    if (G.nextRes) { this.lastAk = null; return this.setData({act: {mode: 'next'}}); }
    if (!G.heroRes) {
      this.lastAk = null;
      return this.setData({act: {mode: 'wait', txt: G.stopReq ? (G.stopReq === 'leave' ? '这手牌会自动弃牌，打完后存档…' : '正在结束这手牌…') : H && H.actor ? `等待 ${H.actor.pos} ${H.actor.name} 行动…` : '发牌中…'}});
    }
    const p = G.seats[E.SIM_HERO], toCall = Math.max(0, H.curBet - p.bet), max = p.bet + p.stack, minTo = Math.min(max, H.curBet + H.minRaise), bb = H.bb;
    const ak = `${H.no}-${H.street}-${H.curBet}-${p.bet}`;
    if (this.lastAk === ak && this.data.act.mode === 'act') return;
    this.lastAk = ak;
    const canRaise = max > H.curBet && p.stack > toCall, pot = E.potNow(), pre = [];
    if (H.street === 0 && H.pfRaises === 0) (G.mode === 'cash' ? [2.5, 3, 4] : [2.2, 2.5, 3]).forEach(x => pre.push([`${x} BB`, x * bb]));
    else if (H.street === 0) [3, 4].forEach(x => pre.push([`${x} 倍`, H.curBet * x]));
    else { const base = pot + toCall; [[.33, '1/3 池'], [.5, '1/2 池'], [.75, '3/4 池'], [1, '1 池']].forEach(([f, l]) => pre.push([l, H.curBet + toCall + base * f])); }
    const raise = canRaise && minTo < max, step = Math.max(1, Math.round(bb / 10));
    const val = Math.min(max, Math.max(minTo, pre[0] ? Math.round(pre[0][1]) : minTo));
    this.raiseVal = val;
    this.setData({act: {
      mode: 'act', fold: toCall > 0, callType: toCall ? 'call' : 'check', callLbl: toCall ? `跟注 ${E.fBB(Math.min(toCall, p.stack))}` : '过牌',
      raise, raiseWord: H.curBet > 0 ? '加注到' : '下注', min: minTo, max, step, val, lbl: E.fBB(val), allinLbl: `全下 ${E.fBB(max)}`,
      presets: pre.filter(x => x[1] >= minTo && x[1] < max).map(x => ({l: x[0], to: Math.round(x[1])})),
    }});
  },
  onRaiseSlide(e) { this.raiseVal = +e.detail.value; this.setData({'act.val': this.raiseVal, 'act.lbl': E.fBB(this.raiseVal)}); },
  onPreset(e) { this.raiseVal = +e.currentTarget.dataset.to; this.setData({'act.val': this.raiseVal, 'act.lbl': E.fBB(this.raiseVal)}); },
  onAct(e) {
    const a = e.currentTarget.dataset.a;
    E.heroAct(a === 'raise' ? {type: 'raise', to: this.raiseVal} : {type: a});
  },
  onNext() { const G = E.G; if (G && G.nextRes) { const r = G.nextRes; G.nextRes = null; r(); } },
  onHint() {
    const G = E.G;
    if (!G || !G.heroRes) return;
    const p = G.seats[E.SIM_HERO];
    G.coachNow = G.coachNow || E.coach(p); G.hint = true;
    const c = G.coachNow;
    this.hintText = `${E.spotText(p)}\n\n学生还没有行动，先看了提示。\n系统推荐：${E.ACT_CN[c.rec]}\n系统给出的理由：${c.why}\n\n请解释为什么推荐这样打，以及其他选择的问题在哪里。`;
    this.clearAI(['hintAI']);
    this.setData({coach: {type: 'hint', rec: E.ACT_CN[c.rec], why: c.why, aiBtn: true}});
  },
  onHintAI() { this.setData({'coach.aiBtn': false}); this.selectComponent('#hintAI').start(E.coachSys(), this.hintText); },
  showCoach(rec) {
    const c = rec.coach;
    this.lastRec = rec;
    this.clearAI(['coachAI', 'hintAI']);
    this.setData({coach: {type: 'verdict', res: rec.res, tag: rec.res === 'ok' ? '正确' : rec.res === 'mid' ? '可以接受' : '这一步有问题', you: E.ACT_CN[rec.type], rec: E.ACT_CN[c.rec], cat: c.cat, why: c.why}});
  },
  onCoachAI() { if (this.lastRec) E.aiExplain(this.lastRec, $('coachAI')); },
  onOpt(e) {
    const k = e.currentTarget.dataset.k, v = e.detail.value, G = E.G;
    if (k === 'auto') { E.simOpt.auto = v; E.ls.set('simAuto', v); }
    if (k === 'fast') { E.simOpt.speed = v ? 'fast' : 'normal'; E.ls.set('simSpeed', E.simOpt.speed); }
    if (k === 'style') { E.simOpt.showStyle = v; E.ls.set('simStyle', v); this.renderTable(); }
    if (k === 'topup' && G && G.cfg) { G.cfg.topup = v; E.ls.set('cashCfg', Object.assign(E.ls.get('cashCfg', {}), {topup: v})); }
  },
  onLeave() { E.stopSim('leave'); },
  onQuit() {
    const mtt = E.G && E.G.mode === 'mtt';
    if (!mtt) return E.stopSim('quit');
    wx.showModal({title: '放弃比赛？', content: '这场比赛会直接结束，并显示总结。', confirmText: '放弃', success: r => { if (r.confirm) E.stopSim('quit'); }});
  },

  /* ---------- summary ---------- */
  showEnd() {
    const G = E.G, d = G.decisions, good = d.filter(x => x.res !== 'no').length, acc = d.length ? Math.round(good / d.length * 100) : 0, mis = d.filter(x => x.res === 'no');
    E.P.sim = (E.P.sim || []).concat([{key: G.key, name: G.S.n, date: today(), res: E.resultText(), acc, dec: d.length}]).slice(-20);
    E.save();
    if (G.mode === 'cash' && d.length >= 5) E.recordSim(acc / 100, G.played);
    const byCat = {};
    d.forEach(x => { const c = x.coach.cat; byCat[c] = byCat[c] || {n: 0, bad: 0}; byCat[c].n++; if (x.res === 'no') byCat[c].bad++; });
    let cash = null;
    if (G.mode === 'cash') {
      const cs = G.cs, n = cs.hands || 1, c = cs.curve, net = c.length ? c[c.length - 1] : 0;
      let curve = '';
      if (c.length > 1) {
        const lo = Math.min(0, ...c), hi = Math.max(0, ...c), W = 600, Hh = 160, sx = i => i / (c.length - 1) * W, sy = v => Hh - (v - lo) / ((hi - lo) || 1) * Hh;
        curve = svgSrc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -6 ${W + 8} ${Hh + 12}"><line x1="0" x2="${W}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}" stroke="#3a5a4c" stroke-dasharray="4 4"/><polyline fill="none" stroke="${net >= 0 ? '#5fc98a' : '#e2604a'}" stroke-width="3" stroke-linejoin="round" points="${c.map((v, i) => sx(i).toFixed(1) + ',' + sy(v).toFixed(1)).join(' ')}"/></svg>`);
      }
      cash = {stats: [['盈亏', E.sgn1(net) + ' BB'], ['bb/100', E.sgn1(net / n * 100)], ['入池率 VPIP', Math.round(cs.vpip / n * 100) + '%'], ['加注率 PFR', Math.round(cs.pfr / n * 100) + '%']], curve, hands: cs.hands};
    }
    this.misRecs = mis;
    const card = c => (c.r === 10 ? '10' : E.rch(c.r)) + E.SUITS[c.s];
    this.setData({view: 'end', end: {
      title: G.S.n, res: E.resultText(), cash,
      stats: [['决策次数', d.length], ['正确率', d.length ? acc + '%' : '—'], ['错误', mis.length], ['打了几手', G.played]],
      cats: Object.keys(byCat).map(k => ({k, t: `${byCat[k].n} 次 · 错 ${byCat[k].bad} 次`})),
      mis: mis.map(x => ({head: `第 ${x.hand} 手 · ${E.STREET_CN[x.street]}`, cards: x.cards.map(card).join(' ') + (x.board.length ? ' | ' + x.board.map(card).join(' ') : ''), you: E.ACT_CN[x.type], rec: E.ACT_CN[x.coach.rec], why: x.coach.why})),
      revBtn: true,
    }}, () => {
      this.clearAI(['aiRevOut'].concat(mis.map((_, i) => 'mis' + i)));
      if (E.AI.cfg.review && E.aiUsable() && d.length >= 3) this.onReview();
    });
    wx.pageScrollTo({scrollTop: 0, duration: 0});
  },
  onReview() { this.setData({'end.revBtn': false}); E.aiReview($('aiRevOut')); },
  onMisAI(e) { const i = +e.currentTarget.dataset.i; E.aiExplain(this.misRecs[i], $('mis' + i)); },
  onAgain() { const G = E.G; E.startSim(G.key, G.cfg); },
  onBack() { this.showPick(); },
});
