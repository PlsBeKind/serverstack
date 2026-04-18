import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ServersPage from './pages/ServersPage.jsx';
import ServerFormPage from './pages/ServerFormPage.jsx';
import ServerDetailPage from './pages/ServerDetailPage.jsx';
import ProvidersPage from './pages/ProvidersPage.jsx';
import ContractsPage from './pages/ContractsPage.jsx';
import CostAnalysisPage from './pages/CostAnalysisPage.jsx';
import ServicesPage from './pages/ServicesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import MonitoringPage from './pages/MonitoringPage.jsx';

export default function App() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage auth={auth} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout auth={auth}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/servers/new" element={<ServerFormPage />} />
        <Route path="/servers/:id" element={<ServerDetailPage />} />
        <Route path="/servers/:id/monitoring" element={<MonitoringPage />} />
        <Route path="/servers/:id/edit" element={<ServerFormPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/costs" element={<CostAnalysisPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
