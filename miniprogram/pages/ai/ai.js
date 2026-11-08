const core = require('../../core/app-core.js');
const {E} = core;
// a phone cannot reach a computer's localhost, so the local Ollama preset is left out here
const KEYS = Object.keys(E.AI_PRESETS).filter(k => k !== 'ollama');

Page({
  data: {presetL: KEYS.map(k => E.AI_PRESETS[k].n), status: '', stCls: 'note'},
  onShow() { this.load(); },
  load() {
    const c = E.AI.cfg;
    if (!KEYS.includes(c.preset)) { c.preset = 'custom'; }
    this.setData({pi: KEYS.indexOf(c.preset), base: c.base, model: c.model, key: c.key, coach: c.coach, opp: c.opp, review: c.review,
      modelPh: c.preset === 'doubao' ? '填写方舟控制台里的接入点 ID' : '模型名称'});
  },
  save() { E.saveAI(); },
  onPreset(e) {
    const k = KEYS[+e.detail.value], v = E.AI_PRESETS[k];
    E.AI.cfg.preset = k;
    if (k !== 'custom') { E.AI.cfg.base = v.base; E.AI.cfg.model = v.model; }
    this.save(); this.load();
  },
  onField(e) { const k = e.currentTarget.dataset.k; E.AI.cfg[k] = String(e.detail.value).trim(); this.save(); },
  onSwitch(e) { E.AI.cfg[e.currentTarget.dataset.k] = e.detail.value; this.save(); },
  onClear() { E.AI.cfg.key = ''; this.save(); this.load(); this.setData({status: '已清除 API Key。', stCls: 'note'}); },
  async onTest() {
    this.setData({status: '正在连接…', stCls: 'note'});
    try {
      const t = await core.aiChat([{role: 'user', content: '只回复“连接成功”四个字。'}], {max: 20, timeout: 20000});
      this.setData({status: '连接成功，模型回复：' + t.slice(0, 40), stCls: 'ok-text'});
    } catch (e) { this.setData({status: '连接失败：' + e.message, stCls: 'err-text'}); }
  },
});
