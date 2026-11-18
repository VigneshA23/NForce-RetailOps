import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      containerStyle={{
        top: 'max(16px, calc(env(safe-area-inset-top) + 8px))',
        right: 16,
      }}
      toastOptions={{ style: { padding: 0, background: 'transparent', boxShadow: 'none', maxWidth: 'none' } }}
    />
  </React.StrictMode>,
)
