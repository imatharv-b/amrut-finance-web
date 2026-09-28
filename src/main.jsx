import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'

import { api } from './lib/api'

// 🔒 Expose the API bridge as a frozen, non-configurable global
// Object.freeze prevents adding/removing/modifying properties
// Object.defineProperty with configurable:false prevents deletion or redefinition
Object.defineProperty(window, 'db', {
  value: Object.freeze({
    invoke: api.invoke
  }),
  writable: false,
  configurable: false,
  enumerable: false // Don't show up in Object.keys(window)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
