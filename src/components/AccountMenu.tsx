import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginDialog } from '@/components/LoginDialog';
import { toast } from 'sonner';

export function AccountMenu() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  if (isLoading) {
    return null;
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="flex items-center gap-1.5 text-xs">
          <User size={12} />
          {user.username}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            toast.info('Signed out');
          }}
          title="Sign out"
        >
          <LogOut size={16} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}>
        <LogIn size={16} className="mr-2" />
        Sign In
      </Button>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
