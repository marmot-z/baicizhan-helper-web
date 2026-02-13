import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import {
  Home,
  Login,
  Dashboard,
  Search,
  StudyCalendar,
  StudyView,
  WordBook,
  WordDetail,
  VipCenter,
  PaymentPage,
  StudyStatistics,
  StudyMidView,
  SpellView,
} from '../pages';
import { ProtectedRoute, PublicRoute } from '../components/RouteGuards';
import MainLayout from '../layouts/MainLayout';

// 路由配置
export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <Home />,
  },
  {
    path: ROUTES.LOGIN,
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: ROUTES.DASHBOARD,
        element: <Dashboard />,
      },
      {
        path: ROUTES.SEARCH,
        element: <Search />,
      },
      {
        path: ROUTES.STUDY_CALENDAR,
        element: <StudyCalendar />,
      },
      {
        path: ROUTES.WORD_BOOK,
        element: <WordBook />,
      },
      {
        path: ROUTES.WORD_DETAIL,
        element: <WordDetail />,
      },
      {
        path: ROUTES.STUDY_STATISTICS,
        element: <StudyStatistics />,
      },
      {
        path: ROUTES.STUDY_MID,
        element: <StudyMidView />,
      },
      {
        path: ROUTES.VIP_CENTER,
        element: <VipCenter />,
      },
    ],
  },
  {
    path: ROUTES.STUDY_VIEW,
    element: (
      <ProtectedRoute>
        <StudyView />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.SPELL_VIEW,
    element: (
      <ProtectedRoute>
        <SpellView />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.PAYMENT_PAGE,
    element: (
      <ProtectedRoute>
        <PaymentPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
