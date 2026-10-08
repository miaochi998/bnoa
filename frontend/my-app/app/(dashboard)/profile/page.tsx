'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/upload/ImageCropper';
import {
    apiClient,
    getAvatarUrl,
    getDefaultAvatarUrl,
} from '@/lib/api';
import type { User } from '@/types/auth';
import type { SystemConfig } from '@/types/config';
import {
    User as UserIcon,
    Mail,
    Phone,
    Shield,
    Clock,
    Lock,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle,
    Eye,
    EyeOff,
    Camera,
    Trash2,
} from 'lucide-react';
import { DictTag } from '@/components/shared/DictTag';

function formatDate(dateString?: string): string {
    if (!dateString) return '未记录';
    return new Date(dateString).toLocaleString('zh-CN');
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // 基本信息编辑
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMsg, setProfileMsg] = useState('');
    const [profileErr, setProfileErr] = useState('');

    // 修改密码
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdMsg, setPwdMsg] = useState('');
    const [pwdErr, setPwdErr] = useState('');
    const [showOldPwd, setShowOldPwd] = useState(false);
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);

    // 头像相关
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [showCropper, setShowCropper] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [defaultAvatar, setDefaultAvatar] = useState('');
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchUser();
        fetchDefaultAvatar();
    }, []);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getCurrentUser();
            setUser(data);
            setEditName(data.name || '');
            setEditEmail(data.email || '');
            setEditPhone(data.phone || '');
            setEditDesc(data.description || '');
        } catch {
            router.push('/login');
        } finally {
            setLoading(false);
        }
    };

    const fetchDefaultAvatar = async () => {
        try {
            const response = await apiClient.getConfigs(
                { category: 'avatar' },
                { page: 1, pageSize: 10 },
            );
            const items = response.items || [];
            const cfg = items.find(
                (c: SystemConfig) => c.key === 'avatar.defaultAvatar',
            );
            if (cfg?.value) {
                setDefaultAvatar(getDefaultAvatarUrl());
            }
        } catch {
            // 忽略
        }
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedImage(file);
        setShowCropper(true);
        if (avatarInputRef.current) avatarInputRef.current.value = '';
    };

    const handleCropComplete = async (croppedFile: File) => {
        try {
            setAvatarUploading(true);
            const result = await apiClient.uploadAvatar(croppedFile);
            setUser(prev => prev ? { ...prev, avatar: result.avatar } : prev);
        } catch (err: any) {
            alert(err.message || '头像上传失败');
        } finally {
            setAvatarUploading(false);
            setSelectedImage(null);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!user?.avatar) return;
        try {
            setAvatarUploading(true);
            await apiClient.deleteAvatar();
            setUser(prev => prev ? { ...prev, avatar: undefined } : prev);
        } catch (err: any) {
            alert(err.message || '删除头像失败');
        } finally {
            setAvatarUploading(false);
        }
    };

    const getInitials = (name?: string) => {
        return (name || '').slice(0, 2).toUpperCase() || 'U';
    };

    const validateEmail = (email: string): string | null => {
        if (!email) return '邮箱不能为空';
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(email)) return '邮箱格式不正确';
        return null;
    };

    const validatePhone = (phone: string): string | null => {
        if (!phone) return null;
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return '手机号格式不正确';
        }
        return null;
    };

    const handleSaveProfile = async () => {
        setProfileMsg('');
        setProfileErr('');

        const emailErr = validateEmail(editEmail);
        if (emailErr) {
            setProfileErr(emailErr);
            return;
        }
        const phoneErr = validatePhone(editPhone);
        if (phoneErr) {
            setProfileErr(phoneErr);
            return;
        }

        try {
            setProfileSaving(true);
            const updated = await apiClient.updateProfile({
                name: editName,
                email: editEmail,
                phone: editPhone,
                description: editDesc,
            });
            setUser(updated);
            setProfileMsg('个人资料已更新');
            setTimeout(() => setProfileMsg(''), 3000);
        } catch (err: any) {
            setProfileErr(err.message || '更新失败');
        } finally {
            setProfileSaving(false);
        }
    };

    const validatePassword = (pwd: string): string | null => {
        if (pwd.length < 8) return '新密码至少8个字符';
        if (!/[a-zA-Z]/.test(pwd)) return '密码必须包含字母';
        if (!/\d/.test(pwd)) return '密码必须包含数字';
        return null;
    };

    const handleChangePassword = async () => {
        setPwdMsg('');
        setPwdErr('');

        if (!oldPassword || !newPassword || !confirmPassword) {
            setPwdErr('请填写所有密码字段');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwdErr('两次输入的新密码不一致');
            return;
        }
        const pwdValidErr = validatePassword(newPassword);
        if (pwdValidErr) {
            setPwdErr(pwdValidErr);
            return;
        }

        try {
            setPwdSaving(true);
            await apiClient.changePassword({
                oldPassword,
                newPassword,
                confirmPassword,
            });
            setPwdMsg('密码修改成功，请重新登录');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                apiClient.clearTokens();
                router.push('/login');
            }, 2000);
        } catch (err: any) {
            setPwdErr(err.message || '密码修改失败');
        } finally {
            setPwdSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    const hasProfileChanges =
        editName !== (user.name || '') ||
        editEmail !== (user.email || '') ||
        editPhone !== (user.phone || '') ||
        editDesc !== (user.description || '');

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div>
                <h1 className="text-2xl font-semibold text-foreground">
                    个人资料
                </h1>
                <p className="text-muted-foreground mt-1">
                    查看和编辑您的个人信息
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左侧：用户概览卡片 */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-card border-border">
                        <CardContent className="p-6">
                            <div className="flex flex-col items-center text-center">
                                {/* 头像区域 */}
                                <div className="relative group mb-4">
                                    <Avatar className="w-20 h-20 border-2 border-border">
                                        <AvatarImage
                                            src={getAvatarUrl(user.id, user.avatar) || defaultAvatar || undefined}
                                            alt={user.name || user.username}
                                        />
                                        <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                                            {getInitials(user.name || user.username)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {/* 悬停遮罩 */}
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={avatarUploading}
                                        className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        {avatarUploading ? (
                                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                                        ) : (
                                            <Camera className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                    <input
                                        ref={avatarInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        className="hidden"
                                        onChange={handleAvatarSelect}
                                    />
                                </div>
                                {user.avatar && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAvatar}
                                        disabled={avatarUploading}
                                        className="text-xs text-muted-foreground hover:text-destructive transition-colors mb-2 flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        删除头像
                                    </button>
                                )}
                                <h2 className="text-lg font-semibold text-foreground">
                                    {user.name || user.username}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    @{user.username}
                                </p>
                                <div className="mt-3">
                                    <DictTag typeCode="user_status" value={user.status} />
                                </div>
                            </div>

                            <Separator className="bg-border my-4" />

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Mail className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-muted-foreground">
                                            邮箱
                                        </p>
                                        <p className="text-sm text-foreground truncate">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Phone className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            手机号
                                        </p>
                                        <p className="text-sm text-foreground">
                                            {user.phone || '未设置'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Shield className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground mb-1">
                                            角色
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.map((role) => (
                                                <Badge
                                                    key={role.id}
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {role.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 账户信息卡片 */}
                    <Card className="bg-card border-border">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                账户信息
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    注册时间
                                </span>
                                <span className="text-sm text-foreground">
                                    {formatDate(user.createdAt)}
                                </span>
                            </div>
                            <Separator className="bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    上次登录
                                </span>
                                <span className="text-sm text-foreground">
                                    {formatDate(user.lastLoginAt)}
                                </span>
                            </div>
                            <Separator className="bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    账户状态
                                </span>
                                <DictTag typeCode="user_status" value={user.status} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 右侧：编辑表单 */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 基本信息编辑 */}
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-primary" />
                                基本信息
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        用户名
                                    </Label>
                                    <Input
                                        value={user.username}
                                        disabled
                                        className="bg-muted/30"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        用户名不可修改
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        显示名称
                                    </Label>
                                    <Input
                                        value={editName}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                        placeholder="请输入显示名称"
                                        className="bg-background"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        邮箱
                                    </Label>
                                    <Input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) =>
                                            setEditEmail(e.target.value)
                                        }
                                        placeholder="请输入邮箱"
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        手机号
                                    </Label>
                                    <Input
                                        value={editPhone}
                                        onChange={(e) =>
                                            setEditPhone(e.target.value)
                                        }
                                        placeholder="请输入手机号"
                                        className="bg-background"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm">
                                    个人简介
                                </Label>
                                <Textarea
                                    value={editDesc}
                                    onChange={(e) =>
                                        setEditDesc(e.target.value)
                                    }
                                    placeholder="简单介绍一下自己..."
                                    rows={3}
                                    className="bg-background resize-none"
                                />
                            </div>

                            {profileMsg && (
                                <div className="flex items-center gap-2 text-sm text-green-500">
                                    <CheckCircle className="w-4 h-4" />
                                    {profileMsg}
                                </div>
                            )}
                            {profileErr && (
                                <div className="flex items-center gap-2 text-sm text-destructive">
                                    <AlertCircle className="w-4 h-4" />
                                    {profileErr}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={
                                        profileSaving ||
                                        !hasProfileChanges
                                    }
                                >
                                    {profileSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    保存修改
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 修改密码 */}
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Lock className="w-5 h-5 text-primary" />
                                修改密码
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm">
                                    当前密码
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showOldPwd ? 'text' : 'password'}
                                        value={oldPassword}
                                        onChange={(e) =>
                                            setOldPassword(e.target.value)
                                        }
                                        placeholder="请输入当前密码"
                                        className="bg-background pr-10"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowOldPwd(!showOldPwd)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showOldPwd ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        新密码
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type={showNewPwd ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) =>
                                                setNewPassword(e.target.value)
                                            }
                                            placeholder="至少8个字符"
                                            className="bg-background pr-10"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPwd(!showNewPwd)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showNewPwd ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        确认新密码
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type={showConfirmPwd ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) =>
                                                setConfirmPassword(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="再次输入新密码"
                                            className="bg-background pr-10"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showConfirmPwd ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                密码修改成功后将自动退出登录，请使用新密码重新登录
                            </p>

                            {pwdMsg && (
                                <div className="flex items-center gap-2 text-sm text-green-500">
                                    <CheckCircle className="w-4 h-4" />
                                    {pwdMsg}
                                </div>
                            )}
                            {pwdErr && (
                                <div className="flex items-center gap-2 text-sm text-destructive">
                                    <AlertCircle className="w-4 h-4" />
                                    {pwdErr}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    onClick={handleChangePassword}
                                    disabled={
                                        pwdSaving ||
                                        !oldPassword ||
                                        !newPassword ||
                                        !confirmPassword
                                    }
                                    variant="outline"
                                >
                                    {pwdSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Lock className="w-4 h-4 mr-2" />
                                    )}
                                    修改密码
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* 头像裁剪弹窗 */}
            <ImageCropper
                image={selectedImage}
                open={showCropper}
                onClose={() => {
                    setShowCropper(false);
                    setSelectedImage(null);
                }}
                onCropComplete={handleCropComplete}
                cropConfig={{
                    aspect: 1,
                    quality: 0.9,
                    format: 'jpeg',
                    maxOutputWidth: 400,
                    maxOutputHeight: 400,
                }}
                title="裁剪头像"
                description="调整裁剪区域，选择头像显示范围"
            />
        </div>
    );
}
