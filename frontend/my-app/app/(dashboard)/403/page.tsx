'use client';

import { ShieldX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
    const router = useRouter();

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center space-y-4">
                <ShieldX className="h-16 w-16 text-muted-foreground mx-auto" />
                <h1 className="text-2xl font-semibold text-foreground">
                    无权访问
                </h1>
                <p className="text-muted-foreground max-w-md">
                    您没有访问此页面的权限，请联系管理员。
                </p>
                <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                >
                    返回仪表盘
                </Button>
            </div>
        </div>
    );
}
