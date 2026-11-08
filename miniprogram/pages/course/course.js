const core = require('../../core/app-core.js');
const {E} = core;

Page({
  data: {},
  onShow() { this.refresh(); },
  refresh() {
    const A = E.activeLesson(), done = E.LESSONS.filter(E.lessonDone).length, pct = Math.round(done / E.LESSONS.length * 100);
    const tracks = Object.keys(E.TRACKS).map(k => { const T = E.TRACKS[k]; return {k, n: T.n, on: k === E.track, sub: `${T.wk} 周 · ${T.lessons.length} 课 · 已完成 ${T.lessons.filter(E.lessonDone).length}`}; });
    const stages = E.CURX.map(S => ({
      name: `${S.stage} · ${S.weeks}`,
      lessons: S.lessons.map(L => {
        const isDone = E.lessonDone(L), isCur = !!(A && A.id === L.id), open = E.unlocked(L);
        return {id: L.id, t: L.t, n: L.idx + 1, sub: `第 ${L.wk} 周${L.exam ? ' · 测验' : ''}`, st: isDone ? 'done' : isCur ? 'cur' : open ? 'open' : 'lock',
          pill: isDone ? '已完成' : isCur ? '进行中' : open ? '可学习' : '未解锁'};
      }),
    }));
    this.setData({
      tracks, stages, pct, head: E.TRACKS[E.track].full,
      ovTitle: A ? `第 ${A.wk} 周 · 第 ${A.idx + 1} 课` : '已毕业',
      ovSub: A ? `已完成 ${done}/${E.LESSONS.length} 课。当前：${A.t}（约 ${A.min} 分钟）` : `${E.LESSONS.length} 节课全部完成。可以继续在练习和模拟赛里保持手感。`,
      activeId: A ? A.id : '',
    });
    wx.setNavigationBarTitle({title: E.TRACKS[E.track].full});
  },
  onTrack(e) {
    const k = e.currentTarget.dataset.k;
    if (k === E.track) return;
    core.setTrack(k);
    this.refresh();
  },
  onLesson(e) {
    const {id, st} = e.currentTarget.dataset;
    if (st === 'lock') return wx.showToast({title: '先完成前面的课程', icon: 'none'});
    wx.navigateTo({url: '/pages/lesson/lesson?id=' + id});
  },
  onGo() { if (this.data.activeId) wx.navigateTo({url: '/pages/lesson/lesson?id=' + this.data.activeId}); },
});
