'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Settings, LogOut } from 'lucide-react';
import { apiClient, getAvatarUrl, getDefaultAvatarUrl } from '@/lib/api';
import { NotificationDropdown } from './NotificationDropdown';
import type { User as UserType } from '@/types/auth';
import { usePermissionStore } from '@/lib/stores/permission-store';

interface HeaderProps {
  user: UserType | null;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { hasPermission } = usePermissionStore();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiClient.logout();
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Breadcrumb or Page Title could go here */}
      <div className="flex-1" />

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 px-2 py-1.5 h-auto hover:bg-card-hover"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={user?.id ? (getAvatarUrl(user.id, user.avatar) || getDefaultAvatarUrl()) : undefined} alt={user?.name || user?.username} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {user?.name ? getInitials(user.name) : user?.username?.slice(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium text-foreground">
                  {user?.name || user?.username || '用户'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.roles?.[0]?.name || '普通用户'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">{user?.name || user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuItem asChild className="cursor-pointer hover:bg-card-hover focus:bg-card-hover">
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>个人资料</span>
              </Link>
            </DropdownMenuItem>
            {hasPermission('system:config') && (
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-card-hover focus:bg-card-hover">
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>系统设置</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>{loggingOut ? '退出中...' : '退出登录'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
