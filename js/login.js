import { getSession } from './services/auth.js';
import { initAuthPage } from './pages/auth.js';

getSession().then(session => {
  if (session) {
    window.location.href = 'index.html';
  } else {
    initAuthPage();
  }
}).catch(() => initAuthPage());
