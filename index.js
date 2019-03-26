import NavSpa from './src/nav-spa'

const Plugin = {}

Plugin.install = (Vue) => {
  if (Plugin.install.installed) return
  Vue.component('nav-spa', NavSpa)
}

if (typeof window !== 'undefined' && window.Vue) {
  Plugin.install(window.Vue)
}

export default Plugin
