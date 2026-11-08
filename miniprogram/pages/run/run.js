// Survival challenge: 100 players, push or fold from 15 BB to the final table.
const core = require('../../core/app-core.js');
const {E, El} = core;
const PAID = 15, FIELD = 100;
const cards = (cs, opts) => cs.map(c => E.cardEl(c, opts).outerHTML).join('');
const seats = (me, opts) => { const d = new El('div'); d.className = 'seats'; E.renderSeats(d, me, opts); return d.outerHTML; };

Page({
  data: {state: 'start', msg: '点击“开始”入座。', log: [], startLbl: '开始'},
  onLoad() { core.reg('run', this); this.R = null; this.setData({seats: seats(0), villain: cards([null, null], {sm: true}), vLbl: '对手', board: '', hero: '', heroLbl: '你', pot: '底池 —'}); this.ui(); },
  onUnload() { core.unreg('run', this); this.gone = true; },
  onShow() { this.refreshBanner(); },
  refreshBanner() { this.setData({banner: core.bannerText('run')}); },
  log(t) { this.setData({log: [t].concat(this.data.log).slice(0, 80)}); },
  ui() {
    const R = this.R, best = E.P.best ? '第 ' + E.P.best + ' 名' : '—';
    if (!R) return this.setData({rows: [['最好成绩', best]]});
    const [sb, bb] = E.RLV[Math.min(R.lvl, E.RLV.length - 1)];
    this.setData({
      phase: R.left <= 9 ? '决赛桌！' : R.left <= PAID ? '已进钱圈' : R.left <= PAID + 4 ? '泡沫期 · 离钱圈 ' + (R.left - PAID) + ' 人' : '距钱圈 ' + (R.left - PAID) + ' 人',
      prog: ((FIELD - R.left) / (FIELD - 9) * 100).toFixed(1),
      rows: [['筹码', E.fmt(R.stack)], ['大盲数', (R.stack / bb).toFixed(1)], ['盲注', `${sb}/${bb}`], ['剩余人数', R.left], ['决策正确', R.dec ? `${R.good}/${R.dec}` : '—'], ['全下被跟', R.allins], ['最好成绩', best]],
    });
  },
  onStart() {
    this.R = {stack: 3000, hand: 0, lvl: 0, left: FIELD, seat: E.ri(0, 8), dec: 0, good: 0, allins: 0};
    this.setData({log: [], startLbl: '再来一次'});
    this.log('入座。起始筹码 3,000（15 BB）。');
    this.deal();
  },
  deal() {
    const R = this.R;
    R.lvl = Math.floor(R.hand / 9);
    const [sb, bb] = E.RLV[Math.min(R.lvl, E.RLV.length - 1)];
    const pi = (R.seat + R.hand) % 9;
    Object.assign(R, {pos: E.POS[pi], pi, sb, bb, ante: bb});
    if (R.hand > 0 && R.hand % 9 === 0) this.log(`盲注升级：${sb}/${bb}，前注 ${bb}`);
    R.hand++; R.deck = E.deck(); R.cards = [R.deck.pop(), R.deck.pop()];
    this.setData({villain: cards([null, null], {sm: true}), vLbl: '对手', board: '', hero: cards(R.cards, {deal: true}), heroLbl: `你 · ${R.pos}`, seats: seats(pi, {folded: i => i < pi})});
    this.ui();
    if (R.pos === 'BB') {
      const walk = Math.random() < 0.4;
      let msg;
      if (walk) { R.stack += sb; msg = `你在大盲位。所有人弃牌给你，白赚小盲 +${sb}。`; }
      else { R.stack -= Math.min(R.stack, bb + R.ante); msg = `你在大盲位，付了大盲和前注（${bb + R.ante}）。前面有人加注，你的牌不够跟，弃牌。`; }
      this.setData({msg, pot: '底池 —'});
      this.log(`#${R.hand} BB 位：${walk ? '+' + sb : '−' + (bb + R.ante)}`);
      if (R.stack <= 0) return this.bust();
      this.ui(); return this.setData({state: 'next'});
    }
    this.setData({pot: `底池 ${E.fmt(sb + bb + R.ante)}`, msg: `前面都弃牌了，轮到你在 ${R.pos}（${E.POS_CN[R.pos]}）。你有 ${(R.stack / bb).toFixed(1)} BB${R.pos === 'SB' ? '，已投入小盲 ' + sb : ''}。`, state: 'act'});
  },
  onPush() { this.act(true); },
  onFold() { this.act(false); },
  async act(push) {
    const R = this.R;
    this.setData({state: 'none'});
    const key = E.keyOf(R.cards[0], R.cards[1]), bbN = R.stack / R.bb, pct = E.pushPct(R.pos, bbN), p = E.PCT[key];
    const should = p <= pct, edge = Math.abs(p - pct) <= 2, right = edge || push === should;
    R.dec++; if (right) R.good++;
    const judge = edge ? '（边缘牌，推或弃都行）' : right ? `（决策正确：范围前 ${pct.toFixed(0)}%，${key} 在前 ${p.toFixed(0)}%）` : `（决策偏差：这里推荐${should ? '全下' : '弃牌'}，范围前 ${pct.toFixed(0)}%，${key} 在前 ${p.toFixed(0)}%）`;
    if (!push) {
      if (R.pos === 'SB') R.stack -= R.sb;
      this.setData({msg: '你弃牌了。' + judge, state: 'next'});
      this.log(`#${R.hand} ${R.pos} ${key} 弃牌 ${right ? '✓' : '✗'}`);
      return this.ui();
    }
    const S = R.stack;
    let caller = null, vc = null;
    for (let j = R.pi + 1; j < 9 && !caller; j++) {
      const h = [R.deck.pop(), R.deck.pop()], vp = E.POS[j];
      this.setData({seats: seats(R.pi, {folded: i => i < R.pi || (i < j && i !== R.pi), act: j}), msg: `你全下 ${E.fmt(S)}！${vp} 在考虑……`});
      await E.wait(380); if (this.gone) return;
      if (E.PCT[E.keyOf(h[0], h[1])] <= E.callPct(bbN, vp)) { caller = vp; vc = h; }
    }
    if (!caller) {
      const gain = R.ante + R.bb + (R.pos === 'SB' ? 0 : R.sb);
      R.stack += gain;
      this.setData({seats: seats(R.pi, {folded: i => i !== R.pi}), msg: `所有人弃牌，你拿下底池 +${E.fmt(gain)}。${judge}`, state: 'next'});
      this.log(`#${R.hand} ${R.pos} ${key} 全下无人跟 +${gain} ${right ? '✓' : '✗'}`);
      return this.ui();
    }
    R.allins++;
    const pot = 2 * S + R.ante + ((R.pos !== 'SB' && caller !== 'SB') ? R.sb : 0) + (caller !== 'BB' ? R.bb : 0);
    this.setData({pot: `底池 ${E.fmt(pot)}`, vLbl: `${caller} 跟注`, villain: cards(vc, {sm: true, deal: true}), msg: `${caller} 用 ${E.keyOf(vc[0], vc[1])} 跟注！发公共牌……`});
    await E.wait(700); if (this.gone) return;
    const board = [];
    for (let i = 0; i < 5; i++) { board.push(R.deck.pop()); this.setData({board: cards(board, {sm: true})}); await E.wait(i < 2 ? 260 : 600); if (this.gone) return; }
    const hs = E.best7([...R.cards, ...board]), vs = E.best7([...vc, ...board]);
    let res;
    if (hs > vs) { R.stack = pot; res = `你赢了！${E.catOf(hs)} 胜过 ${E.catOf(vs)}，筹码涨到 ${E.fmt(pot)}。`; }
    else if (hs < vs) { R.stack = 0; res = `你输了。对手 ${E.catOf(vs)} 胜过你的 ${E.catOf(hs)}。`; }
    else { R.stack = Math.round(pot / 2); res = `平分底池（${E.catOf(hs)}）。`; }
    this.setData({msg: res + ' ' + judge});
    this.log(`#${R.hand} ${R.pos} ${key} 全下 vs ${caller} ${E.keyOf(vc[0], vc[1])} → ${hs > vs ? '赢' : hs < vs ? '输' : '平'} ${right ? '✓' : '✗'}`);
    if (R.stack <= 0) return this.bust();
    this.ui(); this.setData({state: 'next'});
  },
  end(txt, big) {
    const R = this.R;
    this.setData({msg: txt, big, endNote: R.dec < 5 ? '这一场决策少于 5 次，不计入课程任务。' : '', state: 'start'});
    this.ui();
    E.recordRun(R.dec ? R.good / R.dec : 0, R.dec);
  },
  bust() {
    const R = this.R, place = R.left;
    E.setBest(place); this.log(`出局：第 ${place} 名`);
    this.end(this.data.msg, `你以第 ${place} 名出局${place <= PAID ? '，进了钱圈！' : '，差 ' + (place - PAID) + ' 名进钱圈。'} 决策正确 ${R.good}/${R.dec}。`);
  },
  onNext() {
    const R = this.R;
    this.setData({big: '', endNote: ''});
    R.left = Math.max(9, R.left - [0, 0, 1, 1, 1, 2, 2, 3][Math.floor(Math.random() * 8)]);
    if (R.left <= 9) { E.setBest(9); this.log('进入决赛桌'); return this.end('', `恭喜，你进入了决赛桌！100 人里活到了最后 9 人，决策正确 ${R.good}/${R.dec}。`); }
    this.deal();
  },
});
