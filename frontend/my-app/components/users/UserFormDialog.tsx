'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DictSelect } from '@/components/shared/DictSelect';
import { apiClient } from '@/lib/api';
import { User, UserStatus, CreateUserRequest, UpdateUserRequest } from '@/types/user';
import { Role } from '@/types/role';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSuccess: () => void;
}

export function UserFormDialog({ open, onOpenChange, user, onSuccess }: UserFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    phone: '',
    status: UserStatus.ACTIVE,
    roleIds: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!user;

  useEffect(() => {
    // 对话框打开时加载角色列表
    if (!open) return;
    
    const loadRoles = async () => {
      try {
        const rolesData = await apiClient.getAllRoles();
        setRoles(rolesData);
      } catch (error) {
        console.error('Failed to load roles:', error);
      }
    };
    loadRoles();
  }, [open]);

  useEffect(() => {
    if (!open || isEdit) return;
    if (roles.length === 0) return;

    setFormData((prev) => {
      if (prev.roleIds.length > 0) return prev;
      const defaultRole =
        roles.find((r) => r.code === 'user') ||
        roles.find((r) => r.name === '普通用户');
      if (!defaultRole) return prev;
      return { ...prev, roleIds: [defaultRole.id] };
    });
  }, [roles, open, isEdit]);

  useEffect(() => {
    if (user) {
      // 编辑模式：填充表单
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        name: user.name,
        phone: user.phone || '',
        status: user.status,
        roleIds: [], // 需要从后端获取用户的角色ID
      });
    } else {
      // 新增模式：重置表单
      setFormData({
        username: '',
        email: '',
        password: '',
        name: '',
        phone: '',
        status: UserStatus.ACTIVE,
        roleIds: [],
      });
    }
    setErrors({});
  }, [user, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = '用户名只能包含字母、数字和下划线';
    }

    // 邮箱非必填，但如果填写了则需要验证格式
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }

    if (!isEdit && !formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = '密码至少8个字符';
    }

    // 姓名非必填

    if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '手机号格式不正确';
    }

    if (formData.roleIds.length === 0) {
      newErrors.roleIds = '请选择至少一个角色';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      if (isEdit && user) {
        // 更新用户
        const updateData: UpdateUserRequest = {
          email: formData.email,
          name: formData.name,
          phone: formData.phone || undefined,
          status: formData.status,
          roleIds: formData.roleIds.length > 0 ? formData.roleIds : undefined,
        };
        await apiClient.updateUser(user.id, updateData);
      } else {
        // 创建用户
        const createData: CreateUserRequest = {
          username: formData.username,
          email: formData.email.trim() ? formData.email.trim() : undefined,
          password: formData.password,
          name: formData.name.trim() ? formData.name.trim() : undefined,
          phone: formData.phone.trim() ? formData.phone.trim() : undefined,
          roleIds: formData.roleIds,
        };
        await apiClient.createUser(createData);
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to save user:', error);
      // 显示错误信息
      if (error.message) {
        setErrors({ submit: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? '编辑用户' : '新增用户'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground">
              用户名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={isEdit}
              placeholder="请输入用户名"
              className="bg-background border-input"
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              邮箱
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="请输入邮箱"
              className="bg-background border-input"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              密码 {!isEdit && <span className="text-destructive">*</span>}
              {isEdit && <span className="text-muted-foreground text-xs">（留空表示不修改）</span>}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={isEdit ? '不修改请留空' : '请输入密码'}
              className="bg-background border-input"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              姓名
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="请输入姓名"
              className="bg-background border-input"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">
              手机号
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="请输入手机号"
              className="bg-background border-input"
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-foreground">
              状态
            </Label>
            <DictSelect
              typeCode="user_status"
              value={formData.status}
              onChange={(value) => setFormData({ ...formData, status: value as UserStatus })}
              placeholder="选择状态"
              className="bg-background border-input"
            />
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <Label className="text-foreground">
              角色 <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={formData.roleIds.includes(role.id)}
                    onCheckedChange={() => handleRoleToggle(role.id)}
                  />
                  <Label
                    htmlFor={`role-${role.id}`}
                    className="text-sm text-foreground cursor-pointer"
                  >
                    {role.name}
                  </Label>
                </div>
              ))}
            </div>
            {errors.roleIds && (
              <p className="text-sm text-destructive">{errors.roleIds}</p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading ? '保存中...' : isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
