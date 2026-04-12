// 环境配置
const config = {
  // 后端 API 基础地址（icars-admin）
  baseUrl: 'https://meisaizhixing.cn/wx-admin',
  // 小程序来源标识，用于多小程序共用同一后端时区分
  source: 'SSP',
  // 微信小程序 AppID
  appId: 'wx5d88d6c7c216e1f3',
  // 订阅消息模板ID（审核结果通知，从微信后台获取后填入）
  subscribeTemplateId: '8_0YosP9YlA9Y-H8EWBD7hz6NVC81u3eZezVAw_JxYs',
  // 七牛云 CDN 域名替换（CDN证书问题，通过Nginx反代解决）
  cdnDomain: 'https://cdn.meisaizhixing.cn/',
  cdnProxy: 'https://meisaizhixing.cn/qiniu/'
}

module.exports = config
