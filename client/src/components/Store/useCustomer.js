import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Public store customer session — JWT persisted to localStorage,
// account details fetched from /public/store/customer/me on mount
// and after login/register.
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const TOKEN_KEY = 'fablab_store_customer_token';

const readToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export default function useCustomer() {
  const [token, setToken] = useState(readToken);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(!!token);

  const authAxios = useCallback(() => {
    return axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  }, [token]);

  // Fetch the account whenever the token changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setCustomer(null); setLoading(false); return; }
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_URL}/public/store/customer/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) setCustomer(data.customer);
      } catch (err) {
        // Token likely expired — clear it silently
        try { localStorage.removeItem(TOKEN_KEY); } catch {}
        if (!cancelled) { setToken(null); setCustomer(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY) setToken(e.newValue || null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await axios.post(`${API_URL}/public/store/customer/login`, { email, password });
    try { localStorage.setItem(TOKEN_KEY, data.token); } catch {}
    setToken(data.token);
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await axios.post(`${API_URL}/public/store/customer/register`, payload);
    try { localStorage.setItem(TOKEN_KEY, data.token); } catch {}
    setToken(data.token);
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const logout = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setToken(null);
    setCustomer(null);
  }, []);

  return { customer, token, loading, login, register, logout, authAxios };
}
