import { getSession } from './services/auth.js';
import { initAuthPage } from './pages/auth.js?v=release-2.0.1';

getSession().then(session => {
  if (session) {
    window.location.href = '/dashboard';
  } else {
    initAuthPage();
  }
}).catch(() => initAuthPage());
