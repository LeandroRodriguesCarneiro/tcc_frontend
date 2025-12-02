import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, createContext, useEffect, useRef, useCallback } from 'react';
import Login from './components/auth/Login';
import Chat from './components/chat/Chat';
import DatabaseView from './components/database/DatabaseView';
import {
  loadTokens,
  saveTokens,
  updateAccessToken,
  clearTokens,
  resetRefreshCount,
} from './services/authTokenService';

import './styles/variables.css';
import './styles/Base.css';
import './App.css';

export const AuthContext = createContext();

const API_AUTH_URL = process.env.REACT_APP_API_AUTH_URL;

function App() {
  const [tokens, setTokens] = useState(() => loadTokens());
  const [refreshCount, setRefreshCount] = useState(tokens.refreshCount);
  const refreshTimeoutRef = useRef(null);

  const logout = useCallback(() => {
    setTokens({ accessToken: null, refreshToken: null, expiresAt: null });
    setRefreshCount(0);
    clearTokens();
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      if (!tokens.refreshToken || refreshCount >= 3) {
        logout();
        return false;
      }

      const response = await fetch(`${API_AUTH_URL}/api/v1/Auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: tokens.refreshToken }),
      });

      if (!response.ok) {
        logout();
        return false;
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || tokens.refreshToken;
      const expiresInMs = (data.expires_in || 1800) * 1000;
      const newExpiresAt = Date.now() + expiresInMs;

      const newTokens = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      };

      updateAccessToken(newTokens);
      setTokens(newTokens);
      
      const newCount = updateAccessToken(newTokens); 
      setRefreshCount(newCount);

      return true;
    } catch {
      logout();
      return false;
    }
  }, [tokens.refreshToken, refreshCount, logout]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    if (!tokens.expiresAt || !tokens.refreshToken || refreshCount >= 3) {
      return;
    }

    const now = Date.now();
    const msToExpire = tokens.expiresAt - now;
    const msToRefresh = msToExpire - (60 * 1000); // 1 min antes

    if (msToRefresh > 0) {
      refreshTimeoutRef.current = setTimeout(refreshTokens, msToRefresh);
    } else {
      refreshTokens();
    }
  }, [tokens.expiresAt, tokens.refreshToken, refreshCount, refreshTokens]);

  useEffect(() => {
    if (tokens.accessToken && tokens.expiresAt && refreshCount < 3) {
      scheduleRefresh();
    }
  }, [tokens.accessToken, tokens.expiresAt, refreshCount, scheduleRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const setTokensOnLogin = useCallback(({ accessToken, refreshToken, expiresIn }) => {
    const expiresInMs = (expiresIn || 1800) * 1000;
    const expiresAt = Date.now() + expiresInMs;

    const newTokens = { accessToken, refreshToken, expiresAt };
    saveTokens(newTokens);
    resetRefreshCount();
    
    setTokens(newTokens);
    setRefreshCount(0);
    scheduleRefresh();
  }, [scheduleRefresh]);

  const isAuthenticated = !!tokens.accessToken;

  const authValue = {
    tokens,
    refreshCount,
    isAuthenticated,
    setTokensOnLogin,
    logout,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/chat" />} />
          <Route path="/chat" element={isAuthenticated ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/database" element={isAuthenticated ? <DatabaseView /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
