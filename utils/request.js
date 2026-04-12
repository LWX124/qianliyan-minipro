const config = require('../config/index')

/**
 * 修正七牛云 CDN URL（替换为 Nginx 反代地址，解决 CDN SSL 证书问题）
 */
function fixCdnUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.indexOf(config.cdnDomain) === 0) {
    return url.replace(config.cdnDomain, config.cdnProxy)
  }
  // 兼容旧的七牛云测试域名
  if (url.indexOf('http://tcb098rkh.hn-bkt.clouddn.com/') === 0) {
    return url.replace('http://tcb098rkh.hn-bkt.clouddn.com/', config.cdnProxy)
  }
  return url
}

/**
 * 封装 wx.request，自动携带 token 和 source
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('thirdSessionKey') || ''
    const header = Object.assign({
      'content-type': 'application/json',
      'THIRDSESSIONKEY': token,
      'X-Source': config.source
    }, options.header || {})

    wx.request({
      url: config.baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success(res) {
        if (res.data.errorCode === 530) {
          // 未登录，跳转登录
          wx.removeStorageSync('thirdSessionKey')
          wx.showToast({ title: '请先登录', icon: 'none' })
          reject(res.data)
          return
        }
        resolve(res.data)
      },
      fail(err) {
        wx.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

/**
 * 上传文件到服务器
 * @param {string} filePath 文件临时路径
 * @param {function} onProgress 进度回调 (progress) => {}
 */
function uploadFile(filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('thirdSessionKey') || ''
    const uploadTask = wx.uploadFile({
      url: config.baseUrl + '/file/uploadfile',
      filePath: filePath,
      name: 'file',
      header: {
        'THIRDSESSIONKEY': token,
        'X-Source': config.source
      },
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (data.errorCode === 0) {
            resolve({ data: { url: data.data && data.data[0] } })
          } else {
            reject(data)
          }
        } catch (e) {
          reject({ code: -1, msg: '服务器返回数据异常' })
        }
      },
      fail(err) {
        wx.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
    if (onProgress && uploadTask) {
      uploadTask.onProgressUpdate((res) => {
        onProgress(res.progress)
      })
    }
  })
}

module.exports = { request, uploadFile, fixCdnUrl }
