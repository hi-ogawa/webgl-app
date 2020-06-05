// Silly workaround to use AFRAME.THREE in nodejs testing
import jsdom from 'jsdom'
const { window } = (new jsdom.JSDOM('', { url: 'http://localhost' }))
global.window = window
global.XMLHttpRequest = function () {} // cf. https://github.com/Jam3/load-bmfont/blob/3e4c94c35a80c3cb33c8eb3174048b5d6556f343/browser.js#L10
Object.assign(global, window)
