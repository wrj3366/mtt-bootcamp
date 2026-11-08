const {E} = require('../../core/app-core.js');
Page({
  data: {
    items: [
      {p: 'map', t: '赛程地图', d: '一场 MTT 的五个阶段、平均筹码深度曲线，以及大盲数和 M 值计算器。'},
      {p: 'icm', t: 'ICM 实验室', d: '拖动筹码，比较筹码占比和奖金权益，计算泡沫期跟注需要的胜率。'},
      {p: 'run', t: '生存挑战', d: '100 人参赛，从 15 个大盲推弃打进决赛桌。决策对错和输赢结果分开记录。'},
      {p: 'ai', t: 'AI 设置', d: '填写国内大模型的接口，让 AI 讲解、追问、扮演对手和做赛后复盘。'},
    ],
  },
  onShow() { this.setData({aiOn: E.aiUsable()}); },
  onGo(e) { wx.navigateTo({url: `/pages/${e.currentTarget.dataset.p}/${e.currentTarget.dataset.p}`}); },
});
