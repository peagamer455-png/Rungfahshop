import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // เพิ่มบรรทัดนี้
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* นำ BrowserRouter มาครอบ App */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)