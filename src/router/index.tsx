import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import {
  Home,
  Login,
  Dashboard,
  Search,
  StudyPlan,
  StudyCalendar,
  StudyFront,
  WordBook,
  WordDetail,
  VipCenter,
  PaymentPage,
  StudyStatistics,
} from '../pages';
import { ProtectedRoute, PublicRoute } from '../components/RouteGuards';

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
    path: ROUTES.DASHBOARD,
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.SEARCH,
    element: (
      <ProtectedRoute>
        <Search />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.WORD_BOOK,
    element: (
      <ProtectedRoute>
        <WordBook />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.STUDY_PLAN,
    element: (
      <ProtectedRoute>
        <StudyPlan />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.STUDY_CALENDAR,
    element: (
      <ProtectedRoute>
        <StudyCalendar />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.STUDY_FRONT,
    element: (
      <ProtectedRoute>
        <StudyFront />
      </ProtectedRoute>
    ),
  },
  {
          path: ROUTES.WORD_DETAIL,
          element: (
            <ProtectedRoute>
              <WordDetail />
            </ProtectedRoute>
          ),
        },
        {
          path: ROUTES.VIP_CENTER,
          element: (
            <ProtectedRoute>
              <VipCenter />
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
          path: ROUTES.STUDY_STATISTICS,
          element: (
            <ProtectedRoute>
              <StudyStatistics />
            </ProtectedRoute>
          ),
        },
  {
    path: '*',
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);