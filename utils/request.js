const config = require('../config/index')

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
        if (res.data.code === 530) {
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
      url: config.baseUrl + '/file/upload',
      filePath: filePath,
      name: 'file',
      header: {
        'THIRDSESSIONKEY': token,
        'X-Source': config.source
      },
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 200) {
            resolve(data)
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

module.exports = { request, uploadFile }
