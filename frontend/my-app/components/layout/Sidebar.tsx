'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Key,
  FolderOpen,
  HardDrive,
  ShieldAlert,
  FileSearch,
  Activity,
  Upload,
  Bot,
  Fingerprint,
  BookOpen,
  Mail,
  Bell,
  ArrowUpDown,
  Globe,
  Store,
  Truck,
  Package,
  FlaskConical,
  Building2,
  Hammer,
  Boxes,
  Link2,
  Calculator,
  UserCheck,
  FileSpreadsheet,
  TrendingUp,
  StickyNote,
  ArrowUpCircle,
  Wrench,
  ScanSearch,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { usePermissionStore } from '@/lib/stores/permission-store';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 需要的权限编码，不设置则全员可见 */
  permission?: string;
  /** 分组标签，显示在该菜单项上方作为视觉分隔 */
  groupLabel?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    title: '仪表盘',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '用户管理',
    href: '/users',
    icon: Users,
    permission: 'user:list',
  },
  {
    title: '角色权限',
    href: '/roles',
    icon: Shield,
    permission: 'role:list',
  },
  {
    title: '权限管理',
    href: '/permissions',
    icon: Key,
    permission: 'permission:list',
  },
  {
    title: '文件中心',
    icon: FolderOpen,
    children: [
      {
        title: '文件管理',
        href: '/files',
        icon: FileText,
      },
      {
        title: '文件管理设置',
        href: '/settings/file-storage',
        icon: HardDrive,
        permission: 'config:list',
      },
    ],
  },
  {
    title: '安全中心',
    icon: ShieldAlert,
    permission: 'security:events',
    children: [
      {
        title: '安全概览',
        href: '/security',
        icon: Shield,
        permission: 'security:events',
      },
      {
        title: '扫描审核',
        href: '/security/scan-review',
        icon: FileSearch,
        permission: 'security:scan-review',
      },
      {
        title: '安全事件',
        href: '/security/events',
        icon: Activity,
        permission: 'security:events',
      },
      {
        title: '上传安全设置',
        href: '/settings/upload-security',
        icon: Upload,
        permission: 'security:config',
      },
    ],
  },
  {
    title: '系统配置',
    icon: Settings,
    permission: 'config:list',
    children: [
      {
        title: '系统参数',
        href: '/settings',
        icon: Settings,
        permission: 'config:list',
      },
      {
        title: 'AI模型管理',
        href: '/settings/ai-models',
        icon: Bot,
        permission: 'config:list',
      },
      {
        title: '验证码设置',
        href: '/settings/captcha',
        icon: Fingerprint,
        permission: 'config:list',
      },
      {
        title: '数据字典',
        href: '/settings/dictionary',
        icon: BookOpen,
        permission: 'dictionary:list',
      },
      {
        title: '邮件设置',
        href: '/settings/email',
        icon: Mail,
        permission: 'config:list',
      },
      {
        title: '通知管理',
        href: '/settings/notifications',
        icon: Bell,
        permission: 'notification:manage',
      },
      {
        title: '记事本设置',
        href: '/settings/notebook',
        icon: StickyNote,
        permission: 'config:list',
      },
      {
        title: '导入导出',
        href: '/settings/export-import',
        icon: ArrowUpDown,
        permission: 'export:list',
      },
      {
        title: '系统升级',
        href: '/settings/upgrade',
        icon: ArrowUpCircle,
        permission: 'upgrade:view',
      },
      {
        title: '系统备份',
        href: '/settings/backup',
        icon: HardDrive,
        permission: 'backup:view',
      },
    ],
  },
  {
    title: '审计日志',
    href: '/audit-logs',
    icon: ClipboardList,
    permission: 'audit:list',
  },
  {
    title: '常用工具',
    icon: Wrench,
    children: [
      {
        title: '记事本',
        href: '/notebook',
        icon: StickyNote,
        permission: 'notebook:view',
      },
      {
        title: '编号查重',
        href: '/number-check',
        icon: ScanSearch,
        permission: 'number-check:view',
      },
    ],
  },
  {
    title: '达人管理',
    href: '/business/talents',
    icon: UserCheck,
    permission: 'talent:view',
  },
  {
    title: '业务管理',
    icon: Store,
    children: [
      // ── 供应/产品/基础管理 ──
      {
        title: '供应商管理',
        href: '/business/suppliers',
        icon: Truck,
        permission: 'supplier:view',
        groupLabel: '供应/产品/基础',
      },
      {
        title: '产品管理',
        href: '/business/products',
        icon: Package,
        permission: 'product:view',
      },
      {
        title: '耗材供应商',
        href: '/business/consumable-suppliers',
        icon: Building2,
        permission: 'consumable:view',
      },
      {
        title: '耗材管理',
        href: '/business/consumables',
        icon: FlaskConical,
        permission: 'consumable:view',
      },
      {
        title: '成品管理',
        href: '/business/finished-products',
        icon: Boxes,
        permission: 'finished-product:view',
      },
      {
        title: '平台管理',
        href: '/business/platforms',
        icon: Globe,
        permission: 'platform:view',
      },
      {
        title: '店铺管理',
        href: '/business/shops',
        icon: Store,
        permission: 'shop:view',
      },
      {
        title: '快递管理',
        href: '/business/express',
        icon: Truck,
        permission: 'express:view',
      },
      // ── 生产加工管理 ──
      {
        title: '工费管理',
        href: '/business/labor-types',
        icon: Hammer,
        permission: 'labor:view',
        groupLabel: '生产加工',
      },
      // ── 销售运营 ──
      {
        title: '链接管理',
        href: '/business/product-links',
        icon: Link2,
        permission: 'product-link:view',
        groupLabel: '销售运营',
      },
      {
        title: 'SKU管理',
        href: '/business/skus',
        icon: Package,
        permission: 'sku:view',
      },
      {
        title: '定价计算',
        href: '/business/pricing',
        icon: Calculator,
        permission: 'pricing:view',
      },
      {
        title: '付款记录',
        href: '/business/payments',
        icon: Wallet,
        permission: 'payment:view',
        groupLabel: '财务',
      },
    ],
  },
  {
    title: '利润报表',
    icon: FileSpreadsheet,
    permission: 'profit:view',
    children: [
      {
        title: '利润月报表',
        href: '/business/profit-reports',
        icon: FileSpreadsheet,
        permission: 'profit:view',
      },
      {
        title: '利润分析',
        href: '/business/profit-reports/analysis',
        icon: TrendingUp,
        permission: 'profit:analysis',
      },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { hasPermission } = usePermissionStore();

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  // 权限过滤菜单
  const filterMenuByPermission = (items: MenuItem[]): MenuItem[] => {
    return items.reduce<MenuItem[]>((acc, item) => {
      if (item.permission && !hasPermission(item.permission)) {
        return acc;
      }
      if (item.children) {
        const filtered = filterMenuByPermission(item.children);
        if (filtered.length > 0) {
          acc.push({ ...item, children: filtered });
        }
        return acc;
      }
      acc.push(item);
      return acc;
    }, []);
  };

  const visibleMenuItems = filterMenuByPermission(menuItems);

  // 收集所有子菜单路径，用于排除父菜单的误匹配
  const allChildPaths = visibleMenuItems
    .filter(item => item.children)
    .flatMap(item => item.children!.map(child => child.href))
    .filter(Boolean) as string[];

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.href) {
      const isExactMatch = pathname === item.href;
      const isPathMatch = pathname.startsWith(`${item.href}/`);
      
      // 检查是否有更精确的子菜单匹配当前路径
      // 例如：当前路径是/security/events，item.href是/security
      // 则/security/events比/security更精确
      const hasMoreSpecificChildMatch = allChildPaths.some(childPath => 
        childPath !== item.href && 
        childPath.length > item.href!.length &&
        (pathname === childPath || pathname.startsWith(`${childPath}/`))
      );
      
      // 如果有更精确的子菜单匹配，则当前item不激活
      if (hasMoreSpecificChildMatch) return false;
      
      return isExactMatch || isPathMatch;
    }
    if (item.children) {
      return item.children.some(child => {
        if (!child.href) return false;
        const matched = pathname === child.href
          || pathname.startsWith(`${child.href}/`);
        if (!matched) return false;
        // 排除被其他分组子菜单更精确匹配的情况
        const hasMoreSpecific = allChildPaths.some(p =>
          p !== child.href
          && p!.length > child.href!.length
          && (pathname === p || pathname.startsWith(`${p}/`))
        );
        return !hasMoreSpecific;
      });
    }
    return false;
  };

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const isActive = isMenuActive(item);
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.title);

    if (hasChildren) {
      return (
        <div key={item.title}>
          <button
            onClick={() => toggleMenu(item.title)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
              'hover:bg-card-hover active:scale-[0.98]',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? item.title : undefined}
          >
            <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                <ChevronDown className={cn(
                  'h-4 w-4 transition-transform',
                  isExpanded && 'rotate-180'
                )} />
              </>
            )}
          </button>
          {!collapsed && isExpanded && (
            <div className="ml-4 mt-1 space-y-1 pl-2">
              {item.children!.map(child => renderMenuItem(child, true))}
            </div>
          )}
        </div>
      );
    }

    if (isChild && item.groupLabel && !collapsed) {
      return (
        <div key={item.href}>
          <div className="text-[11px] text-muted-foreground/50 px-2 pt-2.5 pb-1 tracking-wider">
            {item.groupLabel}
          </div>
          <Link
            href={item.href!}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md',
              'text-sm font-medium transition-all duration-200',
              'hover:bg-card-hover active:scale-[0.98]',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn(
              'h-4 w-4 flex-shrink-0',
              isActive && 'text-primary'
            )} />
            <span>{item.title}</span>
          </Link>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href!}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
          'hover:bg-card-hover active:scale-[0.98]',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground',
          collapsed && 'justify-center px-2',
          isChild && 'py-2'
        )}
        title={collapsed ? item.title : undefined}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary', isChild && 'h-4 w-4')} />
        {!collapsed && <span>{item.title}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-sm">B</span>
            </div>
            <span className="text-foreground font-semibold">BNOA</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-semibold text-sm">B</span>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border hover:bg-card-hover shadow-sm"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        )}
      </Button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {visibleMenuItems.map((item) => renderMenuItem(item))}
      </nav>
    </aside>
  );
}
