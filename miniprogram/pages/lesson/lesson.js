const core = require('../../core/app-core.js');
const {E, rt} = core;
const LESSON = id => E.ALL_LESSONS.find(l => l.id === id);

Page({
  data: {quiz: null, skipAsk: false},
  onLoad(q) { this.id = q.id; },
  onShow() { this.refresh(); },
  onUnload() { if (this.noteT) { clearTimeout(this.noteT); E.save(); } },
  refresh() {
    const L = LESSON(this.id);
    if (!L) return;
    if (L.tr !== E.track) core.setTrack(L.tr);
    const LS = E.LS(L), A = E.activeLesson(L.tr), st = E.lp(L.id), isCur = !!(A && A.id === L.id);
    const learn = rt(L.learn.map(p => `<p>${p}</p>`).join('') + (L.pts.length ? `<ul>${L.pts.map(p => `<li>${p}</li>`).join('')}</ul>` : '') + `<div class="key"><b>要点：</b>${L.key}</div>`);
    const tasks = L.tasks.map((t, i) => {
      const ok = E.taskOk(L, i), pr = E.taskProgress(L, i), s = st.tasks[i] || {};
      let go = null;
      if (t.t === 'quiz') go = {k: 'quiz', l: ok ? '再测一次' : s.best != null ? '重新测验' : '开始测验'};
      else if (t.t === 'drill') go = {k: 'drill', l: ok ? '再练练' : '去练习'};
      else if (t.t === 'run') go = {k: 'run', l: '去生存挑战'};
      else if (t.t === 'sim') go = {k: 'sim', l: '去现金桌'};
      else if (t.t === 'visit') go = {k: t.k === 'icm' ? 'icm' : 'map', l: '去看看'};
      if (go && !(isCur || ok || t.t === 'quiz')) go = null;
      return {i, ok, label: E.taskLabel(t), check: t.t === 'check', canCheck: isCur || ok, go,
        frac: pr ? Math.round(pr.frac * 100) : null, txt: pr ? pr.txt : ''};
    });
    this.setData({
      eyebrow: `${E.TRACKS[L.tr].curr[L.si].stage} · 第 ${L.wk} 周 · 第 ${L.idx + 1} 课 · 约 ${L.min} 分钟`,
      title: L.t, learn, tasks, isCur, done: st.done, note: st.note || '', needNote: L.tasks.some(t => t.t === 'note'),
      prev: L.idx > 0 ? LS[L.idx - 1].id : '', next: LS[L.idx + 1] && E.unlocked(LS[L.idx + 1]) ? LS[L.idx + 1].id : '',
      waiting: !isCur && !st.done,
    });
    wx.setNavigationBarTitle({title: `第 ${L.idx + 1} 课`});
  },
  onNote(e) {
    const L = LESSON(this.id), st = E.lp(L.id);
    st.note = e.detail.value;
    clearTimeout(this.noteT);
    this.noteT = setTimeout(() => { this.noteT = null; E.save(); if (this.data.isCur) { E.checkDone(L); if (E.lessonDone(L)) this.refresh(); } }, 800);
  },
  onCheck(e) {
    const i = +e.currentTarget.dataset.i, L = LESSON(this.id), t = this.data.tasks[i];
    if (!t.canCheck) return;
    const s = E.lp(L.id).tasks[i] || (E.lp(L.id).tasks[i] = {});
    s.checked = !s.checked; E.save(); E.checkDone(L); this.refresh();
  },
  onLabel(e) { if (this.data.tasks[+e.currentTarget.dataset.i].check) this.onCheck(e); },
  onGo(e) {
    const i = +e.currentTarget.dataset.i, L = LESSON(this.id), t = L.tasks[i], k = this.data.tasks[i].go.k;
    if (k === 'quiz') return this.startQuiz(i);
    if (k === 'drill') { getApp().globalData.drillReq = {d: t.d, f: t.f || null}; return wx.switchTab({url: '/pages/drill/drill'}); }
    if (k === 'sim') return wx.switchTab({url: '/pages/sim/sim'});
    wx.navigateTo({url: `/pages/${k}/${k}`});
  },
  onPrev() { this.id = this.data.prev; this.setData({quiz: null, skipAsk: false}); this.refresh(); wx.pageScrollTo({scrollTop: 0, duration: 0}); },
  onNext() { this.id = this.data.next; this.setData({quiz: null, skipAsk: false}); this.refresh(); wx.pageScrollTo({scrollTop: 0, duration: 0}); },
  onSkip() { this.setData({skipAsk: true}); },
  onSkipNo() { this.setData({skipAsk: false}); },
  onSkipYes() {
    const L = LESSON(this.id);
    E.lp(L.id).done = true; E.save();
    wx.showToast({title: '已跳过，下一课已解锁', icon: 'none'});
    const nx = E.LS(L)[L.idx + 1];
    this.setData({skipAsk: false});
    if (nx) this.id = nx.id;
    this.refresh(); wx.pageScrollTo({scrollTop: 0, duration: 0});
  },

  /* quiz: same rules as the web page */
  startQuiz(i) {
    const L = LESSON(this.id), t = L.tasks[i], st = E.lp(L.id);
    this.qs = E.quizPool(L, t);
    this.qi = {i, k: 0, right: 0, counts: this.data.isCur || st.done, need: E.quizNeed(t), src: t.src};
    this.showQ();
  },
  showQ() {
    const Q = this.qi, q = this.qs[Q.k];
    if (!q) return this.finishQuiz();
    const opts = E.shuffle(q.o.map((x, j) => ({x, ok: j === 0, cls: ''})));
    this.setData({quiz: {ti: Q.i, head: `第 ${Q.k + 1}/${this.qs.length} 题${Q.src !== 'self' ? ' · 来自：' + q.from : ''} · 已答对 ${Q.right}`, q: q.q, opts, answered: false, why: q.why, last: Q.k + 1 >= this.qs.length}});
  },
  onOpt(e) {
    const quiz = this.data.quiz;
    if (!quiz || quiz.answered) return;
    const j = +e.currentTarget.dataset.j, o = quiz.opts[j];
    if (o.ok) this.qi.right++;
    const opts = quiz.opts.map((x, k) => Object.assign({}, x, {cls: x.ok ? 'right' : k === j ? 'wrong' : ''}));
    this.setData({'quiz.opts': opts, 'quiz.answered': true, 'quiz.good': o.ok});
  },
  onQNext() { this.qi.k++; this.showQ(); },
  finishQuiz() {
    const Q = this.qi, L = LESSON(this.id), s = E.lp(L.id).tasks[Q.i] || (E.lp(L.id).tasks[Q.i] = {});
    const pass = Q.right >= Q.need;
    s.best = Math.max(s.best || 0, Q.right);
    if (pass && Q.counts) s.ok = true;
    E.save();
    if (Q.counts) E.checkDone(L);
    this.setData({quiz: {ti: Q.i, result: true, pass, txt: `答对 ${Q.right}/${this.qs.length}，${pass ? '达到要求。' : `需要至少答对 ${Q.need} 题。题目和选项顺序会重新打乱，再试一次吧。`}`}});
  },
  onQDone() {
    if (this.data.quiz.pass) { this.setData({quiz: null}); this.refresh(); }
    else this.startQuiz(this.qi.i);
  },
});
