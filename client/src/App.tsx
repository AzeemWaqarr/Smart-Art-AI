import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { homeFor, useAuth } from './auth';
import type { Role } from './types';
import { PhoneShell, StudentLayout } from './components/Shell';
import { Spinner } from './components/ui';
import { Login, Signup, Welcome } from './pages/Auth';
import { Home } from './pages/Home';
import { Coach } from './pages/Coach';
import { DrawingsList, Feedback } from './pages/Feedback';
import { LessonPage, PracticeList } from './pages/Practice';
import { Progress } from './pages/Progress';
import { Account, Notifications, StudentFamily } from './pages/Account';
import { AddChild, ChildDetail, ParentHome, ParentLayout } from './pages/Parent';
import { AdminLayout } from './admin/AdminLayout';
import { AdminAudit, AdminDashboard, AdminSettings, AdminUserDetail, AdminUsers } from './admin/pages';
import { AdminAi, AdminChallenges, AdminLessons } from './admin/content';

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PhoneShell><Spinner /></PhoneShell>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function OldLessonLink() {
  const { slug } = useParams();
  return <Navigate to={`/app/lessons/${slug}`} replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <PhoneShell><Spinner /></PhoneShell>;
  return <Navigate to={homeFor(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />

      <Route element={<PhoneShell />}>
        <Route path="/welcome" element={<GuestOnly><Welcome /></GuestOnly>} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      </Route>

      <Route path="/app" element={<Guard role="student"><StudentLayout /></Guard>}>
        <Route index element={<Home />} />
        <Route path="coach" element={<Coach />} />
        <Route path="snap" element={<Navigate to="/app/coach" replace />} />
        <Route path="drawings" element={<DrawingsList />} />
        <Route path="drawings/:id" element={<Feedback />} />
        <Route path="lessons" element={<PracticeList />} />
        <Route path="lessons/:slug" element={<LessonPage />} />
        <Route path="practice" element={<Navigate to="/app/lessons" replace />} />
        <Route path="practice/:slug" element={<OldLessonLink />} />
        <Route path="progress" element={<Progress />} />
        <Route path="plans" element={<Navigate to="/app" replace />} />
        <Route path="family" element={<StudentFamily />} />
        <Route path="account" element={<Account backTo="/app/family" />} />
        <Route path="notifications" element={<Notifications backTo="/app" />} />
      </Route>

      <Route path="/parent" element={<Guard role="parent"><ParentLayout /></Guard>}>
        <Route index element={<ParentHome />} />
        <Route path="children/new" element={<AddChild />} />
        <Route path="children/:id" element={<ChildDetail />} />
        <Route path="drawings/:id" element={<Feedback />} />
        <Route path="plans" element={<Navigate to="/parent" replace />} />
        <Route path="notifications" element={<Notifications backTo="/parent" />} />
        <Route path="account" element={<Account backTo="/parent" />} />
      </Route>

      <Route path="/admin" element={<Guard role="admin"><AdminLayout /></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="lessons" element={<AdminLessons />} />
        <Route path="challenges" element={<AdminChallenges />} />
        <Route path="ai" element={<AdminAi />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
