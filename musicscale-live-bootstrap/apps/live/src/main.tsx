import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './styles.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('root_not_found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
