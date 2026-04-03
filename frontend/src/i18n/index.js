import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enServers from './en/servers.json';
import enContracts from './en/contracts.json';
import enMonitoring from './en/monitoring.json';
import deCommon from './de/common.json';
import deDashboard from './de/dashboard.json';
import deServers from './de/servers.json';
import deContracts from './de/contracts.json';
import deMonitoring from './de/monitoring.json';

const defaultLang = typeof window !== 'undefined'
  ? localStorage.getItem('language') || 'en'
  : 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, dashboard: enDashboard, servers: enServers, contracts: enContracts, monitoring: enMonitoring },
      de: { common: deCommon, dashboard: deDashboard, servers: deServers, contracts: deContracts, monitoring: deMonitoring },
    },
    lng: defaultLang,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'dashboard', 'servers', 'contracts', 'monitoring'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

export default i18n;
