# 全局要求
- 使用技术成熟、方便维护的开源技术方案，不要自己造新方案
- 如果有重复逻辑的代码，提取成公共函数或组件

# 本地存储
用户 token、选择的一些信息都会存储到 `localStorage` 中，方便后续使用。一些重新登录、跳转页面需要配合 `localStorage` 中的 token 进行判断。
- 登录成功后，将 token 存储到 `localStorage` 中
- 每次请求接口时，从 `localStorage` 中获取 token 并添加到请求头中
- 当用户退出登录时，将 token 从 `localStorage` 中删除
- 当请求响应时，判断响应码是否为 401，如果是则弹出提示用户未登录，需要重新登录
- 信息存储到 `localStorage` 中的字段名前缀统一为 `baicizhan-helper-web.`

# 接口请求
所有对外请求都需要通过 `axios` 进行封装，统一处理错误、添加请求头、处理响应等。
其他要求如下：
- 请求的域名命名为常量，方便全局修改，开发和部署时会进行替换
- 当请求接口时，需要在请求头中添加 `access_token` 字段，值为 `${token}`，其中 `token` 是用户登录后获取的 token
- 所有接口的响应格式统一如下，code为响应码，message 为错误信息，data 为实际返回。接下来场景描述的数据结构实际为 data 字段对应的内容。
```json
{
    "code": 200,
    "message": "success",
    "data": {}
}
```

## 请求错误处理
- 当响应码为 500 时，提示用户服务报错
- 当响应码为 401 时，清空 `localStorage` 中的 token 并提示用户未登录，需要重新登录
- 当响应码为 403 时，提示用户无权限，需要购买会员
- 当响应码为 200 时，直接返回 data 字段内容

# 具体场景实现设计
## 登录
登录逻辑如下：
1. 用户填写手机号码，然后获取验证码（60秒内只能发送一次验证码）
2. 用户填写验证码，然后点击登录按钮，调用登录接口
3. 登录接口返回 token，将 token 存储到 `localStorage` 中，字段名为 `token`
4. 登录失败或者异常，则提示用户“登录失败，请稍候再试”
5. 只需按照上述逻辑实现即可，无需实现「记住我」、「显示/隐藏密码」等额外逻辑

下面是使用到接口的详细描述：
获取验证码接口：`POST /login/sendSmsVerifyCode/${phoneNum}`
请求参数：
- phoneNum 是用户填写的手机号码，11位数字

响应结果：
```json
{
    "verifyCode": "string"
}
```
- verifyCode 是验证码，字符串类型

登录接口：`POST /login/${phoneNum}/${smsVerifyCode}`
请求参数：
- phoneNum 是用户填写的手机号码，11位数字
- smsVerifyCode 是用户填写的验证码，6位数字

响应参数：
- 登录成功用户的 token，字符串类型