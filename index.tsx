
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { initTheme } from './utils/theme';
import { initCrashReports, reportProblem } from './services/crashReports';
import { onRefused } from './services/cloudSaves';

// Apply the stored theme before first paint (no flash of default palette).
initTheme();

// Crash reports (Android): WebView errors, and changes the cloud refused, as
// their kind and error code only (audit M4).
initCrashReports();
onRefused((key, code) => reportProblem('Cloud write refused', { code, change: key.split(':')[0] }));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);