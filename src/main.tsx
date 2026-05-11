import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyInitialTheme } from './stores/settingsStore'

function applyDevAutoLogin() {
  if (!import.meta.env.DEV) {
    return
  }

  const token = import.meta.env.VITE_DEV_ACCESS_TOKEN?.trim()
  if (!token) {
    return
  }

  const raw = localStorage.getItem('auth-storage')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const existingToken = parsed?.state?.token
      const existingAuthenticated = parsed?.state?.isAuthenticated

      if (existingToken || existingAuthenticated) {
        return
      }
    } catch {
      // Ignore invalid cached auth data and overwrite it below.
    }
  }

  localStorage.setItem(
    'auth-storage',
    JSON.stringify({
      state: {
        user: [{"provider":"weixin","openid":"","unionid":"ogNCmsw5Qy_7TGKXQ-i_ejvNI3iw","nickname":"zhxw","setProvider":true,"setOpenid":true,"setUnionid":true,"setNickname":true},{"provider":"phone","openid":"","unionid":"15870664270","nickname":"zhxw","setProvider":true,"setOpenid":true,"setUnionid":true,"setNickname":true}],
        token,
        isAuthenticated: true,
      },
      version: 0,
    }),
  )
}

applyInitialTheme()
applyDevAutoLogin()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
