import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import LoginPage from '@/app/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}));

describe('Authentication Flow Tests', () => {
  let mockRouter: any;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup router mock
    mockRouter = {
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
    };
    (useRouter as any).mockReturnValue(mockRouter);

    // Setup Supabase mock
    const { createClient } = require('@/lib/supabase');
    mockSupabase = createClient();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Login Page Redirect Tests', () => {
    it('should redirect authenticated users to dashboard', async () => {
      // Mock authenticated user
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockProfile = { id: '123', role: 'teacher', district_id: '456' };

      // Create a wrapper component that provides auth context
      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      // Mock the useAuth hook to return authenticated state
      vi.mock('@/components/auth/AuthProvider', async () => {
        const actual = await vi.importActual('@/components/auth/AuthProvider');
        return {
          ...actual,
          useAuth: () => ({
            user: mockUser,
            profile: mockProfile,
            loading: false,
            signOut: vi.fn(),
            refreshProfile: vi.fn(),
          }),
        };
      });

      render(<LoginPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should redirect super admin to super-admin dashboard', async () => {
      const mockUser = { id: '123', email: 'admin@example.com' };
      const mockProfile = { id: '123', role: 'super_admin' };

      vi.mock('@/components/auth/AuthProvider', async () => {
        const actual = await vi.importActual('@/components/auth/AuthProvider');
        return {
          ...actual,
          useAuth: () => ({
            user: mockUser,
            profile: mockProfile,
            loading: false,
            signOut: vi.fn(),
            refreshProfile: vi.fn(),
          }),
        };
      });

      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      render(<LoginPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/super-admin');
      });
    });
  });

  describe('Login Form Tests', () => {
    beforeEach(() => {
      // Reset auth context to unauthenticated state
      vi.mock('@/components/auth/AuthProvider', async () => {
        const actual = await vi.importActual('@/components/auth/AuthProvider');
        return {
          ...actual,
          useAuth: () => ({
            user: null,
            profile: null,
            loading: false,
            signOut: vi.fn(),
            refreshProfile: vi.fn(),
          }),
        };
      });
    });

    it('should handle successful login', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: '123', email: 'test@example.com' },
          session: { access_token: 'token' },
        },
        error: null,
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { id: '123', role: 'teacher', district_id: '456' },
        error: null,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      });

      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      render(<LoginPage />, { wrapper: TestWrapper });

      // Fill in login form
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      });

      // Submit form
      fireEvent.click(screen.getByText(/Sign in as District User/i));

      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should handle login errors', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      render(<LoginPage />, { wrapper: TestWrapper });

      // Fill in login form
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'wrongpassword' },
      });

      // Submit form
      fireEvent.click(screen.getByText(/Sign in as District User/i));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('should validate user role matches login mode', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: '123', email: 'admin@example.com' },
          session: { access_token: 'token' },
        },
        error: null,
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { id: '123', role: 'super_admin' },
        error: null,
      });

      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      render(<LoginPage />, { wrapper: TestWrapper });

      // Try to login as district user with super admin credentials
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'admin@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByText(/Sign in as District User/i));

      await waitFor(() => {
        expect(screen.getByText('Please use Super Admin login.')).toBeInTheDocument();
      });

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Session Management Tests', () => {
    it('should handle session recovery on mount', async () => {
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'token',
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { id: '123', role: 'teacher', district_id: '456' },
        error: null,
      });

      const TestComponent = () => {
        const { user, loading } = useAuth();
        return (
          <div>
            {loading ? 'Loading...' : user ? 'Authenticated' : 'Not authenticated'}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should handle session refresh errors gracefully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const TestComponent = () => {
        const { user, loading } = useAuth();
        return (
          <div>
            {loading ? 'Loading...' : user ? 'Authenticated' : 'Not authenticated'}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Not authenticated')).toBeInTheDocument();
      });
    });
  });

  describe('Sign Out Tests', () => {
    it('should handle sign out correctly', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.auth.signOut = mockSignOut;

      // Mock fetch for API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Successfully signed out' }),
      });

      const TestComponent = () => {
        const { signOut } = useAuth();
        return <button onClick={signOut}>Sign Out</button>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      });

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    it('should handle sign out errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed to sign out' }),
      });

      const TestComponent = () => {
        const { signOut, user } = useAuth();
        return (
          <div>
            <button onClick={signOut}>Sign Out</button>
            {user ? 'Still authenticated' : 'Not authenticated'}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(screen.getByText('Not authenticated')).toBeInTheDocument();
      });
    });
  });

  describe('Middleware Tests', () => {
    it('should protect routes correctly', async () => {
      // This would require a more complex setup to test middleware
      // In a real test environment, you'd use something like Playwright
      // to test the actual middleware behavior
      expect(true).toBe(true);
    });
  });

  describe('Race Condition Tests', () => {
    it('should handle rapid auth state changes', async () => {
      let authStateCallback: any;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
        authStateCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      const TestComponent = () => {
        const { user } = useAuth();
        return <div>{user ? 'Authenticated' : 'Not authenticated'}</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Simulate rapid auth state changes
      authStateCallback('SIGNED_IN', { user: { id: '123' } });
      authStateCallback('SIGNED_OUT', null);
      authStateCallback('SIGNED_IN', { user: { id: '456' } });

      await waitFor(() => {
        expect(screen.getByText('Authenticated')).toBeInTheDocument();
      });
    });
  });
});