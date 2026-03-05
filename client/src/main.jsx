/* ================================================================
   client/src/main.jsx
   ================================================================
   MODIFICATION : Ajouter l'import de theme.css ICI.
   Ton main.jsx actuel ressemble probablement à ceci.
   Ajoute uniquement la ligne marquée ✅ — ne change rien d'autre.
   ================================================================ */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './theme.css'   // ✅ AJOUTER CETTE LIGNE

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)