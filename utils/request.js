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
 * 上传文件到七牛云（直传，不经过后端中转）
 * @param {string} filePath 文件临时路径
 * @param {function} onProgress 进度回调 (progress) => {}
 */
function uploadFile(filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const sessionKey = wx.getStorageSync('thirdSessionKey') || ''

    // 推断文件扩展名
    var ext = '.mp4'
    var dotIdx = filePath.lastIndexOf('.')
    if (dotIdx > -1) {
      ext = filePath.substring(dotIdx).toLowerCase()
    }

    // 1. 从后端获取七牛上传凭证 + 预签名下载URL
    wx.request({
      url: config.baseUrl + '/file/uptoken?ext=' + encodeURIComponent(ext),
      method: 'GET',
      header: {
        'THIRDSESSIONKEY': sessionKey,
        'X-Source': config.source
      },
      success: function (tokenRes) {
        var data = tokenRes.data
        if (!data || data.errorCode !== 0) {
          reject({ code: -1, msg: data && data.errorMsg || '获取上传凭证失败' })
          return
        }
        var info = data.data
        var upToken = info.token
        var key = info.key
        var signedUrl = info.url

        // 2. 直传七牛华南区（带重试）
        doQiniuUpload(filePath, upToken, key, signedUrl, onProgress, 0, resolve, reject)
      },
      fail: function (err) {
        wx.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      }
    })
  })
}

var MAX_RETRY = 2

function doQiniuUpload(filePath, upToken, key, signedUrl, onProgress, retryCount, resolve, reject) {
  var uploadTask = wx.uploadFile({
    url: 'https://up-z2.qiniup.com',
    filePath: filePath,
    name: 'file',
    formData: {
      token: upToken,
      key: key
    },
    success: function (res) {
      try {
        var result = JSON.parse(res.data)
        if (result.key) {
          resolve({ data: { url: signedUrl } })
        } else if (result.error) {
          reject({ code: -1, msg: result.error })
        } else {
          reject({ code: -1, msg: '七牛上传返回异常' })
        }
      } catch (e) {
        reject({ code: -1, msg: '七牛返回数据解析失败' })
      }
    },
    fail: function (err) {
      if (retryCount < MAX_RETRY) {
        console.warn('上传失败，第' + (retryCount + 1) + '次重试', err)
        doQiniuUpload(filePath, upToken, key, signedUrl, onProgress, retryCount + 1, resolve, reject)
      } else {
        wx.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    }
  })
  if (onProgress && uploadTask) {
    uploadTask.onProgressUpdate(function (res) {
      onProgress(res.progress)
    })
  }
}

module.exports = { request, uploadFile, fixCdnUrl }
