// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Change l'import ici :
import { HashRouter } from 'react-router-dom' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Utilise HashRouter au lieu de BrowserRouter */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)