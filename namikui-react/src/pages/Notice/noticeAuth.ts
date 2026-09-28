import { useAuth } from '../../context/AuthContext';

export function useNoticeUser(): { username: string; role: string | null } {
  const { currentUser } = useAuth();
  return { username: currentUser.username ?? 'Unknown', role: currentUser.role };
}
