import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import {
  Home,
  Login,
  Dashboard,
  WordBook,
  StudyPlan,
  StudyCalendar,
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
    path: '*',
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);