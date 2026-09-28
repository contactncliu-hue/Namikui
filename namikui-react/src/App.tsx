import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login/Login';
import Home from './pages/Home/Home';
import Notice from './pages/Notice/Notice';
import Members from './pages/Members/Members';
import BlackGold from './pages/BlackGold/BlackGold';
import Events from './pages/Events/Events';
import VsPoints from './pages/VsPoints/VsPoints';
import Discussion from './pages/Discussion/Discussion';
import History from './pages/History/History';
import Roles from './pages/Roles/Roles';

function Gate() {
  const { currentUser, loading } = useAuth();

  if (loading) return null;

  if (!currentUser.username) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <AppDataProvider>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Home />} />
          <Route path="notice" element={<Notice />} />
          <Route path="members" element={<Members />} />
          <Route path="blackgold" element={<BlackGold />} />
          <Route path="events" element={<Events />} />
          <Route path="vspoints" element={<VsPoints />} />
          <Route path="discussion" element={<Discussion />} />
          <Route path="history" element={<History />} />
          <Route path="roles" element={<Roles />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppDataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
