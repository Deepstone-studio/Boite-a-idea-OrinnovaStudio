const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(t) {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  try {
    const res = await fetch(API + path, Object.assign({}, options, { headers }));
    let data = null;
    const ct = res.headers.get('content-type') || '';
    
    if (ct.includes('application/json')) {
      try { data = await res.json(); } catch (e) { data = null; }
    } else {
      data = await res.text();
    }
    
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Erreur ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

const api = {
  register: (d) => request('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login: (d) => request('/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  me: () => request('/auth/me'),
  listIdeas: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return request('/ideas' + (qs ? '?' + qs : ''));
  },
  createIdea: (d) => request('/ideas', { method: 'POST', body: JSON.stringify(d) }),
  updateIdea: (id, d) => request('/ideas/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteIdea: (id) => request('/ideas/' + id, { method: 'DELETE' }),
  pinIdea: (id) => request('/ideas/' + id + '/pin', { method: 'PATCH' }),
  logout: () => {
      setToken(null);
      // Optional: Call backend logout endpoint if needed
      // return request('/auth/logout', { method: 'POST' }); 
      return Promise.resolve();
  }
};

window.api = api;
window.setToken = setToken;
window.getToken = getToken;