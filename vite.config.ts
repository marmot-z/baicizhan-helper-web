import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET, LEARNING_AGENT_PROXY_TARGET } = loadEnv(mode, process.cwd(), [
    'API_PROXY_TARGET',
    'LEARNING_AGENT_PROXY_TARGET'
  ])

  return {
    plugins: [react()],
    server: {
      proxy: {
        '^/(?:agent|api/learning-agent)(?:/|\\?|$)': {
          target: LEARNING_AGENT_PROXY_TARGET || 'http://127.0.0.1:18034',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/agent(?=\/|\?|$)/, '/api/learning-agent')
        },
        '^/api(?:/|\\?|$)': {
          target: API_PROXY_TARGET || 'https://www.baicizhan-helper.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  }
})
