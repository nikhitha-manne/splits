import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { CreateGroupScreen } from './screens/CreateGroupScreen';
import { GroupDetailScreen } from './screens/GroupDetailScreen';
import { AcceptInviteScreen } from './screens/AcceptInviteScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ChartsScreen } from './screens/ChartsScreen';
import { DirectThreadsScreen } from './screens/DirectThreadsScreen';
import { DirectDetailScreen } from './screens/DirectDetailScreen';
import { AddExpenseScreen } from './screens/add-expense/AddExpenseScreen';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthLayout } from './components/AuthLayout';
import { AppLayout } from './components/AppLayout';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthLayout>
                <LoginScreen />
              </AuthLayout>
            }
          />
          <Route
            path="/signup"
            element={
              <AuthLayout>
                <SignupScreen />
              </AuthLayout>
            }
          />
          <Route path="/invite/:token" element={<AcceptInviteScreen />} />
          <Route element={<ProtectedRoute />}>
            <Route
              path="/home"
              element={
                <AppLayout>
                  <HomeScreen />
                </AppLayout>
              }
            />
            <Route
              path="/groups"
              element={
                <AppLayout>
                  <GroupsScreen />
                </AppLayout>
              }
            />
            <Route
              path="/groups/create"
              element={
                <AppLayout>
                  <CreateGroupScreen />
                </AppLayout>
              }
            />
            <Route
              path="/groups/:groupId"
              element={
                <AppLayout>
                  <GroupDetailScreen />
                </AppLayout>
              }
            />
            <Route
              path="/direct"
              element={
                <AppLayout>
                  <DirectThreadsScreen />
                </AppLayout>
              }
            />
            <Route
              path="/direct/:directId"
              element={
                <AppLayout>
                  <DirectDetailScreen />
                </AppLayout>
              }
            />
            <Route
              path="/add-expense"
              element={
                <AppLayout>
                  <AddExpenseScreen />
                </AppLayout>
              }
            />
            <Route
              path="/profile"
              element={
                <AppLayout>
                  <ProfileScreen />
                </AppLayout>
              }
            />
            <Route
              path="/charts"
              element={
                <AppLayout>
                  <ChartsScreen />
                </AppLayout>
              }
            />
          </Route>
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
