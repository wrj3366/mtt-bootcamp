// One AI conversation: the first answer, then the player's follow-up questions.
const {E, aiChat} = require('../../core/app-core.js');

Component({
  data: {list: [], ask: false, busy: false, input: '', sugs: E.AI_SUG, setup: false},
  methods: {
    clear() { this._msgs = null; this.setData({list: [], ask: false, busy: false, input: '', setup: false}); },
    start(sys, first, opts = {}) {
      this._opts = Object.assign({wait: 'AI 教练思考中…', fail: 'AI 讲解失败', max: 600, timeout: 40000}, opts);
      if (!E.aiUsable()) {
        this._msgs = null;
        this.setData({list: [{t: '还没有设置 AI。到“工具 → AI 设置”填写接口地址、模型和 API Key 后就能用。', cls: 'err'}], ask: false, setup: true});
        return;
      }
      this._msgs = [{role: 'system', content: sys + E.FOLLOW_SYS}, {role: 'user', content: first}];
      this.setData({list: [], ask: false, setup: false});
      this.run(true);
    },
    async run(firstTime) {
      const o = this._opts, msgs = this._msgs;
      const list = this.data.list.concat([{t: o.wait, cls: 'wait'}]), i = list.length - 1;
      this.setData({list, busy: true});
      // keep the opening context plus the last few turns so long chats stay small
      const send = msgs.length > 12 ? [msgs[0], msgs[1], msgs[2], ...msgs.slice(-9)] : msgs;
      try {
        const t = await aiChat(send, {max: firstTime ? o.max : 500, timeout: o.timeout});
        if (this._msgs !== msgs) return;
        msgs.push({role: 'assistant', content: t});
        this.setData({[`list[${i}]`]: {t, cls: ''}});
      } catch (e) {
        if (this._msgs !== msgs) return;
        if (!firstTime) msgs.pop();
        this.setData({[`list[${i}]`]: {t: (firstTime ? o.fail : '追问失败') + '：' + e.message, cls: 'err'}});
      }
      this.setData({busy: false, ask: msgs.length > 2});
    },
    go(q) {
      q = (q || '').trim();
      if (!q || this.data.busy || !this._msgs) return;
      this._msgs.push({role: 'user', content: q});
      this.setData({input: '', list: this.data.list.concat([{t: q, cls: 'me'}])});
      this.run(false);
    },
    onInput(e) { this.setData({input: e.detail.value}); },
    onSend() { this.go(this.data.input); },
    onSug(e) { this.go(e.currentTarget.dataset.q); },
    onSetup() { wx.navigateTo({url: '/pages/ai/ai'}); },
  },
});
