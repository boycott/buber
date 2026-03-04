import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveUser, getUserProfiles, getSessions } from '../supabase-api';
import { supabase } from '../../supabase';

vi.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }
}));

describe('Supabase API pure-effect wrappers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getActiveUser', () => {
    it('returns Success on valid user', async () => {
      const mockUser = { id: 'u1' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const res = await getActiveUser();
      res.match({
        Success: (user) => expect(user).toEqual(mockUser),
        Failure: () => expect.fail('Should have succeeded')
      });
    });

    it('returns Failure on auth error', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      const res = await getActiveUser();
      res.match({
        Failure: (err) => expect(err).toBe('Auth Error: Invalid token'),
        Success: () => expect.fail('Should have failed')
      });
    });
  });

  describe('getUserProfiles', () => {
    it('returns Success and handles supabase fluent API', async () => {
      const mockData = [{ id: '1', role: 'admin' }];

      const mockSelect = vi.fn().mockResolvedValue({ data: mockData, error: null });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const res = await getUserProfiles();

      expect(supabase.from).toHaveBeenCalledWith('Profile');
      res.match({
        Success: (profiles) => expect(profiles).toEqual(mockData),
        Failure: () => expect.fail('Should succeed')
      });
    });

    it('returns Failure on database error', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database down' } });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const res = await getUserProfiles();

      res.match({
        Failure: (err) => expect(err).toContain('Database down'),
        Success: () => expect.fail('Should fail')
      });
    });
  });

  describe('Comment Moderation', () => {
    describe('getBlogComments', () => {
      it('returns paginated comments and counts successfully', async () => {
        const mockData = [{ id: 'c1', content: 'hello' }];
        const mockCount = 1;

        // Mock count query
        const mockCountSelect = vi.fn().mockResolvedValue({ data: null, count: mockCount, error: null });

        // Mock data query
        const mockRange = vi.fn().mockResolvedValue({ data: mockData, error: null });
        const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
        const mockDataSelect = vi.fn().mockReturnValue({ order: mockOrder });

        (supabase.from as any).mockImplementation(() => {
          // It's called twice in Promise.all, we just return an object that satisfies both chains
          return {
            select: vi.fn((...args) => {
              const options = args[1];
              if (options && options.count === 'exact') return mockCountSelect();
              return mockDataSelect();
            })
          };
        });

        const res = await import('../supabase-api').then(m => m.getBlogComments(1, 10));

        res.match({
          Success: (result) => {
            expect(result.comments).toEqual(mockData);
            expect(result.totalCount).toBe(mockCount);
            expect(result.totalPages).toBe(1);
          },
          Failure: () => expect.fail('Should succeed')
        });
      });
    });

    describe('toggleCommentApproval', () => {
      it('updates the boolean and returns Success null', async () => {
        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        (supabase.from as any).mockReturnValue({ update: mockUpdate });

        const res = await import('../supabase-api').then(m => m.toggleCommentApproval('c1', false));

        expect(mockUpdate).toHaveBeenCalledWith({ is_approved: true });
        expect(mockEq).toHaveBeenCalledWith('id', 'c1');

        res.match({
          Success: (v) => expect(v).toBeNull(),
          Failure: () => expect.fail('Should succeed')
        });
      });
    });

    describe('deleteComment', () => {
      it('deletes the comment and returns Success null', async () => {
        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
        (supabase.from as any).mockReturnValue({ delete: mockDelete });

        const res = await import('../supabase-api').then(m => m.deleteComment('c1'));

        expect(mockEq).toHaveBeenCalledWith('id', 'c1');

        res.match({
          Success: (v) => expect(v).toBeNull(),
          Failure: () => expect.fail('Should succeed')
        });
      });
    });
  });
});
