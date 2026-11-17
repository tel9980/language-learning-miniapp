const storage = require('./utils/storage')

App({
  globalData: {
    lang: 'en'
  },
  onLaunch() {
    storage.init()
    this.globalData.lang = storage.getCurrentLang()
  }
})
