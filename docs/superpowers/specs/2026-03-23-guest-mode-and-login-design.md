# 千里眼小程序游客模式与登录流程设计

**日期**: 2026-03-23
**版本**: 1.0
**状态**: 待审核

## 1. 背景和目标

### 1.1 当前问题

千里眼微信小程序当前存在以下问题：

1. 小程序启动时自动触发微信登录，没有游客模式
2. "我的"页面没有登录状态的区分，无法引导用户登录
3. 首页功能按钮（录制视频、拍照上传）没有登录检查，直接跳转
4. 缺少统一的登录状态管理机制

### 1.2 目标

实现游客模式和完善的登录流程，具体目标：

1. 支持游客状态，用户可以在未登录时浏览小程序
2. "我的"页面根据登录状态显示不同内容，引导用户登录
3. 需要登录的功能（录制视频、拍照上传、上传记录等）在游客状态下触发登录
4. 建立全局登录状态管理机制，确保状态同步
5. 实现 token 有效性验证，及时发现过期情况

## 2. 需求总结

### 2.1 功能需求

1. **游客模式**
   - 启动时检查本地 token，无 token 则进入游客模式
   - 游客可以浏览小程序，但无法使用需要登录的功能

2. **"我的"页面**
   - 游客状态：显示默认头像、"游客"文字、"立即登录"按钮，隐藏统计数据
   - 登录状态：显示微信头像（open-data）、昵称、userId、统计数据

3. **功能访问控制**
   - 个人数据相关功能需要登录：录制视频、拍照上传、上传记录、我的积分
   - 通用功能游客可访问：使用教程、公告、在线客服
   - 游客点击需要登录的功能时，直接触发微信登录，登录成功后自动进入功能页面

4. **登录流程**
   - 启动时检查 token，有则验证有效性，无则进入游客模式
   - 点击"立即登录"或功能按钮时触发微信登录
   - 登录成功后更新全局状态，刷新页面数据

5. **Token 管理**
   - 启动时验证 token 有效性（调用后端接口）
   - Token 过期时自动清除，切换到游客状态
   - 支持登录状态持久化

### 2.2 非功能需求

1. **用户体验**：登录流程流畅，无多余弹窗
2. **性能**：启动时快速验证 token，不阻塞页面渲染
3. **容错性**：网络异常、token 过期等情况有友好提示
4. **并发控制**：多个页面同时触发登录时，只执行一次登录流程

## 3. 方案选择

### 3.1 候选方案

**方案 A：全局状态管理方案（已选择）**
- 在 app.js 中维护全局登录状态
- 提供统一的登录方法，支持回调
- 各页面通过全局状态判断和响应

**方案 B：登录拦截器方案**
- 封装登录拦截器工具类
- 所有需要登录的操作通过拦截器处理
- 使用 Promise 封装

**方案 C：页面级检查方案**
- 每个页面独立检查登录状态
- 不使用全局状态，通过 storage 同步

### 3.2 选择理由

选择方案 A 的原因：

1. **用户体验最佳**：全局状态管理确保所有页面的登录状态实时同步
2. **代码质量高**：登录逻辑集中，易于维护和扩展
3. **扩展性强**：未来添加更多登录相关功能只需修改 app.js
4. **符合最佳实践**：微信小程序官方推荐的状态管理方式

## 4. 详细设计

### 4.1 整体架构

```
┌─────────────────────────────────────────┐
│         前端小程序层                      │
│  ┌─────────────────────────────────┐   │
│  │  全局状态管理 (app.js)           │   │
│  │  - isLogin                       │   │
│  │  - userInfo                      │   │
│  │  - login() / logout()            │   │
│  └─────────────────────────────────┘   │
│  ┌──────────┐  ┌──────────┐           │
│  │ 我的页面  │  │ 首页     │  ...      │
│  └──────────┘  └──────────┘           │
│  ┌─────────────────────────────────┐   │
│  │  工具层 (utils)                  │   │
│  │  - request.js (HTTP 封装)        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────��───────────────┘
                    ↓ HTTP
┌─────────────────────────────────────────┐
│         后端 API 层                      │
│  - /user/wxMiniLogin (登录)             │
│  - /user/checkToken (验证 token) 新增   │
│  - /user/personalCenter (个人中心)      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         微信服务层                       │
│  - wx.login() (获取 code)               │
│  - open-data (显示头像昵称)             │
└─────────────────────────────────────────┘
```

### 4.2 前端实现

#### 4.2.1 app.js 全局状态管理

**globalData 结构：**

```javascript
globalData: {
  isLogin: false,           // 登录状态
  isCheckingLogin: true,    // 启动时验证 token 中
  userInfo: {               // 用户信息
    userId: 0,
    name: '',
    avatar: ''              // 预留
  },
  thirdSessionKey: '',      // token
  isLoggingIn: false,       // 登录中标志
  loginCallbacks: []        // 登录回调队列
}
```

**核心方法：**

1. **checkLoginStatus()** - 启动时验证 token
   - 检查 storage 中的 thirdSessionKey
   - 如果有，调用后端 `/user/checkToken` 验证
   - 验证成功：更新 globalData.isLogin = true，保存用户信息
   - 验证失败：清除 token，保持游客状态

2. **login(options)** - 统一登录方法
   - 参数：`{ success: function, fail: function }`
   - 检查是否正在登录中，是则将回调加入队列
   - 调用 wx.login() 获取 code
   - 调用 `/user/wxMiniLogin` 接口
   - 保存 token 和用户信息到 storage 和 globalData
   - 更新 isLogin = true
   - 执行所有回调队列中的 success 回调

3. **logout()** - 登出方法
   - 清除 storage 中的 token 和 userId
   - 重置 globalData.isLogin = false
   - 清空 userInfo

**实现代码结构：**

```javascript
const config = require('./config/index')

App({
  globalData: { /* ... */ },

  onLaunch() {
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('thirdSessionKey')
    if (!token) {
      this.globalData.isLogin = false
      this.globalData.isCheckingLogin = false
      return
    }

    // 调用后端验证 token
    wx.request({
      url: config.baseUrl + '/user/checkToken',
      header: {
        'THIRDSESSIONKEY': token,
        'X-Source': config.source
      },
      success: (res) => {
        if (res.data.code === 200) {
          this.globalData.isLogin = true
          this.globalData.userInfo = res.data.data
          this.globalData.thirdSessionKey = token
        } else {
          // token 无效，清除
          wx.removeStorageSync('thirdSessionKey')
          wx.removeStorageSync('userId')
          this.globalData.isLogin = false
        }
        this.globalData.isCheckingLogin = false
      },
      fail: () => {
        // 网络错误，进入游客模式
        this.globalData.isLogin = false
        this.globalData.isCheckingLogin = false
        console.error('验证 token 失败，进入游客模式')
      }
    })
  },

  login(options = {}) {
    // 如果正在登录中，将回调加入队列
    if (this.globalData.isLoggingIn) {
      this.globalData.loginCallbacks.push(options)
      return
    }

    this.globalData.isLoggingIn = true

    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: config.baseUrl + '/user/wxMiniLogin',
            method: 'POST',
            data: { code: res.code, source: config.source },
            header: { 'content-type': 'application/json' },
            success: (loginRes) => {
              // 先重置登录状态，避免回调执行时的竞态条件
              this.globalData.isLoggingIn = false

              if (loginRes.data.code === 200) {
                const data = loginRes.data.data
                this.globalData.thirdSessionKey = data.thirdSessionKey
                this.globalData.userInfo = {
                  userId: data.userId,
                  name: data.name
                }
                this.globalData.isLogin = true

                wx.setStorageSync('thirdSessionKey', data.thirdSessionKey)
                wx.setStorageSync('userId', data.userId)

                // 执行当前回调
                options.success && options.success()

                // 执行队列中的所有回调
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.success && cb.success()
                })
                this.globalData.loginCallbacks = []
              } else {
                // 执行当前回调
                options.fail && options.fail(loginRes.data.msg)

                // 执行队列中的所有回调
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.fail && cb.fail(loginRes.data.msg)
                })
                this.globalData.loginCallbacks = []
              }
            },
            fail: (err) => {
              // 先重置登录状态
              this.globalData.isLoggingIn = false

              // 执行当前回调
              options.fail && options.fail('登录请求失败')

              // 执行队列中的所有回调
              this.globalData.loginCallbacks.forEach(cb => {
                cb.fail && cb.fail('登录请求失败')
              })
              this.globalData.loginCallbacks = []
            }
          })
        }
      },
      fail: (err) => {
        // 先重置登录状态
        this.globalData.isLoggingIn = false

        // 执行当前回调
        options.fail && options.fail('wx.login 失败')

        // 执行队列中的所有回调
        this.globalData.loginCallbacks.forEach(cb => {
          cb.fail && cb.fail('wx.login 失败')
        })
        this.globalData.loginCallbacks = []
      }
    })
  },

  logout() {
    wx.removeStorageSync('thirdSessionKey')
    wx.removeStorageSync('userId')
    this.globalData.isLogin = false
    this.globalData.thirdSessionKey = ''
    this.globalData.userInfo = { userId: 0, name: '' }
  }
})
```

#### 4.2.2 "我的"页面改造

**页面数据结构：**

```javascript
data: {
  isLogin: false,           // 从 app.globalData 同步
  userInfo: {},             // 用户信息
  statistics: {             // 统计数据
    totalReward: 0,
    caseReward: 0,
    taskReward: 0
  }
}
```

**页面逻辑：**

```javascript
Page({
  data: { /* ... */ },

  onShow() {
    const app = getApp()
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo
    })

    // 如果已登录，获取个人中心数据
    if (app.globalData.isLogin) {
      this.loadPersonalData()
    }
  },

  loadPersonalData() {
    const { request } = require('../../utils/request')
    request({
      url: '/user/personalCenter',
      method: 'GET'
    }).then(res => {
      if (res.code === 200) {
        this.setData({
          statistics: {
            totalReward: res.data.totalReward || 0,
            caseReward: res.data.caseReward || 0,
            taskReward: res.data.taskReward || 0
          }
        })
      }
    }).catch(err => {
      if (err.code === 530) {
        // token 过期，切换到游客状态
        getApp().logout()
        this.setData({ isLogin: false })
      }
    })
  },

  handleLogin() {
    const app = getApp()
    app.login({
      success: () => {
        // 登录成功，刷新页面
        this.setData({
          isLogin: true,
          userInfo: app.globalData.userInfo
        })
        this.loadPersonalData()
        wx.showToast({ title: '登录成功', icon: 'success' })
      },
      fail: (msg) => {
        wx.showToast({ title: msg || '登录失败', icon: 'none' })
      }
    })
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          const app = getApp()
          app.logout()
          this.setData({
            isLogin: false,
            userInfo: {},
            statistics: { totalReward: 0, caseReward: 0, taskReward: 0 }
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  goUploadHistory() {
    const app = getApp()
    if (!app.globalData.isLogin) {
      // 需要登录
      app.login({
        success: () => {
          wx.navigateTo({ url: '/pages/upload-history/upload-history' })
        }
      })
    } else {
      wx.navigateTo({ url: '/pages/upload-history/upload-history' })
    }
  },

  // 其他方法...
})
```

**页面布局（mine.wxml）：**

```xml
<view class="page">
  <!-- 游客状态 -->
  <view wx:if="{{!isLogin}}" class="user-header guest-mode">
    <view class="user-info">
      <view class="avatar avatar-placeholder">
        <text class="avatar-text">👤</text>
      </view>
      <view class="user-detail">
        <text class="nickname">游客</text>
        <text class="guest-hint">登录后查看更多功能</text>
      </view>
    </view>
    <button class="login-btn" bindtap="handleLogin">立即登录</button>
  </view>

  <!-- 登录状态 -->
  <view wx:else class="user-header">
    <view class="user-info">
      <open-data class="avatar" type="userAvatarUrl"></open-data>
      <view class="user-detail">
        <text class="nickname">{{userInfo.name || '微信用户'}}</text>
        <view class="user-id">
          <text>ID: {{userInfo.userId}}</text>
          <view class="copy-btn" bindtap="copyId">复制</view>
        </view>
      </view>
      <view class="logout-btn" bindtap="handleLogout">退出登录</view>
    </view>

    <!-- 统计数据 -->
    <view class="stats-row">
      <view class="stat-item">
        <text class="stat-num">{{statistics.totalReward}}</text>
        <text class="stat-label">合计奖励</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{statistics.caseReward}}</text>
        <text class="stat-label">报案奖励</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{statistics.taskReward}}</text>
        <text class="stat-label">任务奖励</text>
      </view>
    </view>
  </view>

  <!-- 功能网格示例 -->
  <view class="func-grid card">
    <view class="func-item" bindtap="goUploadHistory">
      <text class="func-icon">📋</text>
      <text class="func-name">上传记录</text>
    </view>
    <view class="func-item" bindtap="onComingSoon">
      <text class="func-icon">📖</text>
      <text class="func-name">使用教程</text>
    </view>
    <!-- 其他功能项... -->
  </view>
</view>
```

#### 4.2.3 首页功能按钮改造

**index.js 修改：**

```javascript
Page({
  data: { /* ... */ },

  goRecordVideo() {
    const app = getApp()
    if (!app.globalData.isLogin) {
      // 未登录，触发登录
      app.login({
        success: () => {
          // 登录成功后跳转
          wx.navigateTo({ url: '/pages/record-video/record-video' })
        },
        fail: (msg) => {
          wx.showToast({ title: msg || '登录失败', icon: 'none' })
        }
      })
    } else {
      // 已登录，直接跳转
      wx.navigateTo({ url: '/pages/record-video/record-video' })
    }
  },

  goTakePhoto() {
    const app = getApp()
    if (!app.globalData.isLogin) {
      // 未登录，触发登录
      app.login({
        success: () => {
          // 登录成功后跳转
          wx.navigateTo({ url: '/pages/take-photo/take-photo' })
        },
        fail: (msg) => {
          wx.showToast({ title: msg || '登录失败', icon: 'none' })
        }
      })
    } else {
      // 已登录，直接跳转
      wx.navigateTo({ url: '/pages/take-photo/take-photo' })
    }
  },

  // 其他方法...
})
```

### 4.3 后端实现

#### 4.3.1 新增 /user/checkToken 接口

**接口定义：**
- **路径**: `/user/checkToken`
- **方法**: GET
- **请求头**: THIRDSESSIONKEY, X-Source
- **功能**: 验证 token 是否有效，返回用户基本信息

**实现代码（UserController.java）：**

```java
@ApiOperation(value = "验证token")
@RequestMapping(value = "/checkToken", method = RequestMethod.GET)
public JSONObject checkToken(HttpServletRequest request) {
    JSONObject result = new JSONObject();
    TokenPojo currentLoginUser = getCurrentLoginUser(request);

    if (currentLoginUser == null) {
        result.put("code", 530);
        result.put("msg", "用户未登录");
        return result;
    }

    Integer id = currentLoginUser.getAppUserEntity().getId();
    String name = currentLoginUser.getAppUserEntity().getName();

    JSONObject data = new JSONObject();
    data.put("userId", id);
    data.put("name", name);

    result.put("code", 200);
    result.put("msg", "token有效");
    result.put("data", data);
    return result;
}
```

**响应格式：**

成功：
```json
{
  "code": 200,
  "msg": "token有效",
  "data": {
    "userId": 123,
    "name": "微信用户12345"
  }
}
```

失败：
```json
{
  "code": 530,
  "msg": "用户未登录"
}
```

### 4.4 数据流

#### 4.4.1 启动验证流程

```
小程序启动
    ↓
app.onLaunch()
    ↓
checkLoginStatus()
    ↓
检查 storage.thirdSessionKey
    ↓
有 token? ──否──→ 保持游客状态 (isLogin = false)
    ↓ 是
调用 /user/checkToken
    ↓
后端验证 Redis 中的 token
    ↓
有效? ──否──→ 清除 token，游客状态
    ↓ 是
更新 globalData (isLogin = true, userInfo)
    ↓
各页面 onShow 时读取状态
```

#### 4.4.2 登录流程

```
用户点击登录
    ↓
app.login({ success, fail })
    ↓
正在登录中? ──是──→ 将回调加入队列，等待
    ↓ 否
设置 isLoggingIn = true
    ↓
wx.login() 获取 code
    ↓
调用 /user/wxMiniLogin (code, source)
    ↓
后端: code → openid → 查询/创建用户 → 生成 token
    ↓
返回 { thirdSessionKey, userId, name }
    ↓
保存到 storage 和 globalData
    ↓
更新 isLogin = true
    ↓
执行所有回调队列中的 success 回调
    ↓
设置 isLoggingIn = false
```

#### 4.4.3 功能访问流程

```
用户点击功能按钮
    ↓
检查 globalData.isLogin
    ↓
已登录? ──是──→ 直接跳转到目标页面
    ↓ 否
调用 app.login({ success: () => 跳转 })
    ↓
登录成功后自动跳转
```

### 4.5 错误处理

#### 4.5.1 错误场景和处理策略

| 错误场景 | 处理策略 |
|---------|---------|
| 网络错误 | 显示"网络请求失败"，不清除 token，下次启动重试 |
| Token 过期 | 清除 storage 中的 token，更新 isLogin = false，提示"登录已过期" |
| 登录失败 | 显示具体错误信息，执行 fail 回调，清空回调队列 |
| 并发登录 | 使用 isLoggingIn 标志位，后续请求加入回调队列 |
| 接口异常 | 530 错误清除 token，其他错误显示提示但保持状态 |

#### 4.5.2 边界情况处理

1. **用户拒绝微信登录授权**: 显示提示，允许重试
2. **后端服务不可用**: 显示友好提示，保持游客状态可用
3. **Token 在使用中过期**: 下次请求时自动检测到 530，提示重新登录
4. **多设备登录**: 后端会踢掉旧 token，旧设备下次请求时自动检测到过期

## 5. 测试要点

### 5.1 功能测试

1. **游客状态**
   - 启动小程序，无 token 时显示游客状态
   - "我的"页面显示游客占位信息和"立即登录"按钮
   - 统计数据区域被隐藏

2. **登录流程**
   - 点击"立即登录"按钮，触发微信登录
   - 登录成功后页面自动更新，显示用户信息和统计数据
   - 登录失败时显示错误提示

3. **功能访问控制**
   - 游客点击"录制视频"按钮，触发登录，登录成功后自动跳转
   - 游客点击"拍照上传"按钮，触发登录，登录成功后自动跳转
   - 游客点击"上传记录"，触发登录
   - 游客可以直接访问"使用教程"、"公告"、"在线客服"

4. **Token 验证**
   - 启动时有 token，调用 /user/checkToken 验证
   - Token 有效时保持登录状态
   - Token 无效时清除并进入游客状态

5. **状态同步**
   - 在"我的"页面登录后，返回首页，首页功能按钮可直接使用
   - 在首页登录后，切换到"我的"页面，显示登录状态

### 5.2 边界测试

1. **Token 过期**
   - 模拟 token 过期（后端返回 530）
   - 验证是否清除 token 并切换到游客状态
   - 验证是否显示友好提示

2. **网络异常**
   - 断网情况下启动小程序
   - 验证是否有友好提示
   - 验证不会清除本地 token

3. **并发登录**
   - 快速点击多个需要登录的按钮
   - 验证只触发一次登录流程
   - 验证所有回调都被正确执行

4. **多设备登录**
   - 在设备 A 登录
   - 在设备 B 登录同一账号
   - 验证设备 A 的 token 失效
   - 验证设备 A 下次请求时提示重新登录

### 5.3 用户体验测试

1. **登录流程流畅性**：从点击到登录成功，无多余弹窗
2. **错误提示友好性**：各种错误情况都有清晰的提示
3. **页面切换自然性**：登录后页面更新流畅，无闪烁

## 6. 实施计划

### 6.1 实施步骤

1. **后端实现**（预计 0.5 小时）
   - 在 UserController.java 中新增 /user/checkToken 接口
   - 测试接口功能

2. **前端实现**（预计 2 小时）
   - 修改 app.js，实现全局状态管理
   - 改造"我的"页面，支持游客/登录状态切换
   - 改造首页功能按钮，添加登录检查
   - 调整样式，优化游客状态显示

3. **联调测试**（预计 1 小时）
   - 测试启动验证流程
   - 测试登录流程
   - 测试功能访问控制
   - 测试各种边界情况

4. **优化和修复**（预计 0.5 小时）
   - 根据测试结果修复问题
   - 优化用户体验细节

### 6.2 风险和注意事项

1. **后端 AppID 配置**：注意 WxMiniLoginController 中的 AppID 切换逻辑，确保使用正确的 AppID（当前硬编码为 wxfbf28088488787ee，需要改为 wx5d88d6c7c216e1f3）

2. **open-data 组件**：需要在真机上测试，开发工具可能显示异常

3. **Token 有效期和刷新策略**：
   - 后端设置的 30 天有效期，前端逻辑已正确处理过期情况
   - 当前版本不支持自动刷新 token，用户需要重新登录
   - 未来可考虑实现静默刷新机制：在 token 即将过期时（如剩余 3 天）自动调用登录接口刷新

4. **并发控制**：需要仔细测试多个页面同时触发登录的情况，已通过回调队列机制处理

5. **request 工具使用说明**：
   - app.js 中直接使用 wx.request，因为需要在应用初始化时执行，此时 utils 模块可能未完全加载
   - 页面中使用 utils/request.js 封装的 request 方法，自动携带 token 和 source
   - 两种方式都能正确处理 530 错误码（token 过期）

6. **启动时的加载状态**：
   - 添加了 isCheckingLogin 标志位，页面可以根据此标志显示加载状态
   - 建议在页面 onShow 时检查 isCheckingLogin，如果为 true 则显示加载提示
   - 验证完成后 isCheckingLogin 会被设置为 false

## 7. 总结

本设计方案通过全局状态管理实现了游客模式和完善的登录流程，主要特点：

1. **用户体验优先**：登录流程流畅，无多余弹窗，自动跳转
2. **状态管理清晰**：全局状态集中管理，各页面实时同步
3. **容错性强**：各种异常情况都有友好处理
4. **扩展性好**：未来添加更多登录相关功能容易扩展

实施后将显著提升用户体验，同时为后续功能开发提供良好的基础。
