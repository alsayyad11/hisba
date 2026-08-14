import { getSession } from './services/auth.js';
import { initAuthPage } from './pages/auth.js?v=release-2.3.0';

getSession().then(session => {
  if (session) {
    window.location.href = '/dashboard';
  } else {
    initAuthPage();
  }
}).catch(() => initAuthPage());
