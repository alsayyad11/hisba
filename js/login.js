import { getSession } from './services/auth.js';
import { initAuthPage } from './pages/auth.js?v=auth-brand-v2';

getSession().then(session => {
  if (session) {
    window.location.href = '/dashboard';
  } else {
    initAuthPage();
  }
}).catch(() => initAuthPage());
