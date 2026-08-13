import { getSession } from './services/auth.js';
import { initAuthPage } from './pages/auth.js?v=locale-singleton-v1';

getSession().then(session => {
  if (session) {
    window.location.href = '/dashboard';
  } else {
    initAuthPage();
  }
}).catch(() => initAuthPage());
