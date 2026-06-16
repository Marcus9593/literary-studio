const { platform } = process

if (platform === 'win32') {
  module.exports = require('./win32')
} else if (platform === 'darwin') {
  module.exports = require('./darwin')
} else {
  // Linux 等暂沿用 macOS 路径策略
  module.exports = require('./darwin')
}
