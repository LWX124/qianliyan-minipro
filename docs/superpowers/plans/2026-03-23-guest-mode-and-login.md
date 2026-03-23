# Guest Mode and Login Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement guest mode and login flow for the WeChat mini-program, allowing users to browse as guests and login when accessing protected features.

**Architecture:** Global state management in app.js maintains login status. Pages check login state and trigger login flow when needed. Backend provides token validation endpoint. Login callbacks queue handles concurrent login requests.

**Tech Stack:** WeChat Mini-Program, JavaScript, Java Spring Boot, Redis

---

## File Structure

**Frontend (Mini-Program):**
- Modify: `app.js` - Global state management, login/logout methods
- Modify: `pages/mine/mine.js` - Guest/login state handling, personal data loading
- Modify: `pages/mine/mine.wxml` - Guest/login UI layouts
- Modify: `pages/mine/mine.wxss` - Styling for guest/login states
- Modify: `pages/index/index.js` - Login checks for feature buttons
- Reference: `config/index.js` - API base URL and source config
- Reference: `utils/request.js` - HTTP request wrapper

**Backend (Java):**
- Modify: `c-web/web/src/main/java/com/cheji/web/modular/controller/UserController.java` - Add checkToken endpoint

---

## Task 1: Backend - Add Token Validation Endpoint

**Files:**
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-backend/c-web/web/src/main/java/com/cheji/web/modular/controller/UserController.java`

- [ ] **Step 1: Add checkToken method to UserController**

Add this method after the existing methods in UserController.java:

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

- [ ] **Step 2: Test the endpoint with valid token**

Using curl or Postman:
```bash
curl -X GET "http://114.215.211.119:8081/cServer/user/checkToken" \
  -H "THIRDSESSIONKEY: <valid_token>" \
  -H "X-Source: qianliyan"
```

Expected response:
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

- [ ] **Step 3: Test the endpoint with invalid token**

```bash
curl -X GET "http://114.215.211.119:8081/cServer/user/checkToken" \
  -H "THIRDSESSIONKEY: invalid_token" \
  -H "X-Source: qianliyan"
```

Expected response:
```json
{
  "code": 530,
  "msg": "用户未登录"
}
```

- [ ] **Step 4: Commit backend changes**

```bash
cd /Users/lwx/Workspace/waibao/qianliyan/qianliyan-backend
git add c-web/web/src/main/java/com/cheji/web/modular/controller/UserController.java
git commit -m "feat(backend): add checkToken endpoint for token validation"
```

---

## Task 2: Frontend - App.js Global State Management

**Files:**
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/app.js`

- [ ] **Step 1: Update globalData structure**

Replace the existing globalData in app.js:

```javascript
globalData: {
  isLogin: false,           // 登录状态
  isCheckingLogin: true,    // 启动时验证 token 中
  userInfo: {               // 用户信息
    userId: 0,
    name: ''
  },
  thirdSessionKey: '',      // token
  isLoggingIn: false,       // 登录中标志
  loginCallbacks: []        // 登录回调队列
}
```

- [ ] **Step 2: Add config import at top of file**

Add at the very beginning of app.js, before App({...}):

```javascript
const config = require('./config/index')
```

- [ ] **Step 3: Replace autoLogin with checkLoginStatus**

Replace the existing autoLogin() method with checkLoginStatus():

```javascript
// 启动时验证 token
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
}
```

- [ ] **Step 4: Update onLaunch to call checkLoginStatus**

Replace the existing onLaunch() method:

```javascript
onLaunch() {
  this.checkLoginStatus()
}
```

- [ ] **Step 5: Test startup flow with no token**

Run in WeChat DevTools:
1. Clear storage: Storage tab → Clear
2. Restart mini-program
3. Check Console for: "验证 token 失败，进入游客模式" (if network fails) or no error
4. Verify globalData.isLogin = false

Expected: App starts in guest mode

- [ ] **Step 6: Commit app.js state management**

```bash
git add app.js
git commit -m "feat(frontend): add global state management and token validation on startup"
```

---

## Task 3: Frontend - App.js Login and Logout Methods

**Files:**
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/app.js`

- [ ] **Step 1: Add login method**

Add this method after checkLoginStatus() in app.js:

```javascript
// 统一登录方法
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

            if (loginRes.data.code === 200 && loginRes.data.data) {
              const data = loginRes.data.data

              // 验证必需字段
              if (!data.thirdSessionKey || !data.userId) {
                options.fail && options.fail('登录数据不完整')
                this.globalData.loginCallbacks.forEach(cb => {
                  cb.fail && cb.fail('登录数据不完整')
                })
                this.globalData.loginCallbacks = []
                return
              }

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
              options.fail && options.fail(loginRes.data.msg || '登录失败')

              // 执行队列中的所有回调
              this.globalData.loginCallbacks.forEach(cb => {
                cb.fail && cb.fail(loginRes.data.msg || '登录失败')
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
}
```

- [ ] **Step 2: Add logout method**

Add this method after login():

```javascript
// 登出方法
logout() {
  wx.removeStorageSync('thirdSessionKey')
  wx.removeStorageSync('userId')
  this.globalData.isLogin = false
  this.globalData.thirdSessionKey = ''
  this.globalData.userInfo = { userId: 0, name: '' }
  this.globalData.loginCallbacks = []  // 清除待处理的登录回调
}
```

- [ ] **Step 3: Remove old wxLogin method**

Delete the existing wxLogin() method completely (it's replaced by login()).

- [ ] **Step 4: Test login flow**

In WeChat DevTools Console:
```javascript
const app = getApp()
app.login({
  success: () => console.log('Login success:', app.globalData.userInfo),
  fail: (msg) => console.log('Login failed:', msg)
})
```

Expected: Login succeeds, console shows user info

- [ ] **Step 5: Test logout**

In Console:
```javascript
const app = getApp()
app.logout()
console.log('After logout:', app.globalData.isLogin, app.globalData.userInfo)
```

Expected: isLogin = false, userInfo = { userId: 0, name: '' }

- [ ] **Step 6: Commit login/logout methods**

```bash
git add app.js
git commit -m "feat(frontend): add login and logout methods with callback queue"
```

---

## Task 4: Frontend - Mine Page Guest State

**Files:**
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/mine/mine.js`
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/mine/mine.wxml`
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/mine/mine.wxss`

- [ ] **Step 1: Update mine.js data structure**

Replace the data section in mine.js:

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

- [ ] **Step 2: Update onShow to check login state**

Replace the onShow() method in mine.js:

```javascript
onShow() {
  const app = getApp()

  // 如果正在验证登录状态，等待验证完成
  if (app.globalData.isCheckingLogin) {
    // 可以显示加载提示
    return
  }

  this.setData({
    isLogin: app.globalData.isLogin,
    userInfo: app.globalData.userInfo
  })

  // 如果已登录，获取个人中心数据
  if (app.globalData.isLogin) {
    this.loadPersonalData()
  }
}
```

- [ ] **Step 3: Add guest state UI to mine.wxml**

Replace the user-header section in mine.wxml:

```xml
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

<!-- 登录状态 (will be completed in next task) -->
<view wx:else class="user-header">
  <text>已登录</text>
</view>
```

- [ ] **Step 4: Add guest mode styles to mine.wxss**

Add these styles to mine.wxss:

```css
.guest-mode {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.guest-hint {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.login-btn {
  margin-top: 32rpx;
  background: #fff;
  color: #667eea;
  border-radius: 48rpx;
  padding: 24rpx 64rpx;
  font-size: 28rpx;
  font-weight: 500;
}
```

- [ ] **Step 5: Test guest state display**

Run in WeChat DevTools:
1. Clear storage
2. Restart app
3. Navigate to "我的" page
4. Verify: Shows guest avatar, "游客" text, "立即登录" button
5. Verify: Statistics section is hidden

Expected: Guest UI displays correctly

- [ ] **Step 6: Commit guest state UI**

```bash
git add pages/mine/mine.js pages/mine/mine.wxml pages/mine/mine.wxss
git commit -m "feat(frontend): add guest state UI to mine page"
```

---

## Task 5: Frontend - Mine Page Login State

**Files:**
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/mine/mine.js`
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/mine/mine.wxml`
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/mine/mine.wxss`

- [ ] **Step 1: Add loadPersonalData method to mine.js**

Add this method after onShow():

```javascript
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
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
    } else {
      // 其他错误，显示提示但不清除登录状态
      console.error('获取个人数据失败:', err)
      wx.showToast({ title: '获取数据失败', icon: 'none' })
    }
  })
}
```

- [ ] **Step 2: Add handleLogin method**

Add after loadPersonalData():

```javascript
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
}
```

- [ ] **Step 3: Add handleLogout method**

Add after handleLogin():

```javascript
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
}
```

- [ ] **Step 4: Update goUploadHistory to check login**

Replace the existing goUploadHistory() method:

```javascript
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
}
```

- [ ] **Step 5: Update login state UI in mine.wxml**

Replace the "登录状态" section:

```xml
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
```

- [ ] **Step 6: Add login state styles to mine.wxss**

Add these styles:

```css
.logout-btn {
  position: absolute;
  top: 32rpx;
  right: 32rpx;
  font-size: 24rpx;
  color: #999;
  padding: 8rpx 16rpx;
  border: 1rpx solid #ddd;
  border-radius: 32rpx;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  margin-top: 48rpx;
  padding: 32rpx 0;
  border-top: 1rpx solid rgba(0, 0, 0, 0.1);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}
```

- [ ] **Step 7: Test login state display**

Run in WeChat DevTools:
1. Click "立即登录" button
2. Verify: Login succeeds, page updates to show user info
3. Verify: Statistics display (may be 0 if no data)
4. Click "退出登录"
5. Verify: Confirmation modal appears
6. Confirm logout
7. Verify: Returns to guest state

Expected: Login/logout flow works correctly

- [ ] **Step 8: Commit login state UI**

```bash
git add pages/mine/mine.js pages/mine/mine.wxml pages/mine/mine.wxss
git commit -m "feat(frontend): add login state UI and login/logout handlers to mine page"
```

---

## Task 6: Frontend - Index Page Login Checks

**Files:**
- Modify: `/Users/lwx/Workspace/waibao/qianliyan/qianliyan-minipro/pages/index/index.js`

- [ ] **Step 1: Update goRecordVideo with login check**

Replace the existing goRecordVideo() method in index.js:

```javascript
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
}
```

- [ ] **Step 2: Update goTakePhoto with login check**

Replace the existing goTakePhoto() method:

```javascript
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
}
```

- [ ] **Step 3: Test record video button as guest**

Run in WeChat DevTools:
1. Logout if logged in
2. Go to index page
3. Click "开始录制事故视频" button
4. Verify: Login flow triggers
5. After login, verify: Automatically navigates to record-video page

Expected: Login triggers and auto-navigates on success

- [ ] **Step 4: Test take photo button as guest**

1. Logout
2. Click "拍照上传事故照片" button
3. Verify: Login triggers
4. After login, verify: Navigates to take-photo page

Expected: Same behavior as record video

- [ ] **Step 5: Test buttons when already logged in**

1. Ensure logged in
2. Click both buttons
3. Verify: Direct navigation without login prompt

Expected: No login prompt, direct navigation

- [ ] **Step 6: Commit index page login checks**

```bash
git add pages/index/index.js
git commit -m "feat(frontend): add login checks to index page feature buttons"
```

---

## Task 7: Integration Testing and Optimization

**Files:**
- All modified files

- [ ] **Step 1: Test complete guest-to-login flow**

Manual test sequence:
1. Clear all storage
2. Restart mini-program
3. Verify: Starts in guest mode
4. Navigate to "我的" page
5. Verify: Shows guest UI
6. Click "立即登录"
7. Verify: Login succeeds
8. Verify: Page updates to show user info
9. Navigate to index page
10. Click feature buttons
11. Verify: Direct navigation (no login prompt)

Expected: Complete flow works smoothly

- [ ] **Step 2: Test token expiry handling**

Manual test:
1. Login successfully
2. In backend, manually delete the token from Redis (or wait 30 days)
3. Restart mini-program
4. Verify: Detects invalid token, enters guest mode
5. Try to access "上传记录"
6. Verify: Prompts for login

Expected: Graceful handling of expired token

- [ ] **Step 3: Test concurrent login requests**

Manual test:
1. Logout
2. Quickly click multiple feature buttons (record video, take photo, upload history)
3. Verify: Only one login dialog appears
4. After login, verify: All buttons work

Expected: No duplicate login prompts

- [ ] **Step 4: Test network error handling**

Manual test:
1. Disable network in DevTools
2. Restart mini-program
3. Verify: Shows error message, enters guest mode
4. Enable network
5. Try to login
6. Verify: Login works

Expected: Graceful network error handling

- [ ] **Step 5: Test on real device**

Deploy to real WeChat:
1. Test all flows on actual phone
2. Verify: open-data component shows real avatar
3. Verify: All features work as expected

Expected: Works correctly on real device

- [ ] **Step 6: Fix any issues found**

If issues found during testing:
- Document the issue
- Fix the code
- Re-test
- Commit fixes with descriptive messages

- [ ] **Step 7: Final commit and summary**

```bash
git add .
git commit -m "test: complete integration testing and fix issues"
```

Create a summary of changes:
- Backend: Added /user/checkToken endpoint
- Frontend: Implemented guest mode and login flow
- Testing: All scenarios tested and working

---

## Completion Checklist

- [ ] Backend checkToken endpoint working
- [ ] App.js global state management implemented
- [ ] Mine page shows guest/login states correctly
- [ ] Index page feature buttons check login
- [ ] Token validation on startup works
- [ ] Login/logout flows work correctly
- [ ] Concurrent login handled properly
- [ ] Token expiry handled gracefully
- [ ] Network errors handled gracefully
- [ ] Tested on real device
- [ ] All code committed with clear messages

---

## Notes

**Testing Strategy:**
- Manual testing in WeChat DevTools
- Real device testing for open-data component
- Backend endpoint testing with curl/Postman

**Common Issues:**
- open-data component may not show in DevTools (test on real device)
- Backend AppID in WxMiniLoginController needs to match config (wx5d88d6c7c216e1f3)
- Token validation requires backend server running

**Reference:**
- Design spec: `docs/superpowers/specs/2026-03-23-guest-mode-and-login-design.md`
- Backend base URL: `http://114.215.211.119:8081/cServer`
- Source identifier: `qianliyan`
