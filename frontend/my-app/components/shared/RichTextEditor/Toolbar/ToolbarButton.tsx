// Toolbar/ToolbarButton.tsx
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    title: string;
    isActive?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

export function ToolbarButton({
    icon,
    title,
    isActive = false,
    disabled = false,
    onClick,
}: ToolbarButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${
                        isActive
                            ? 'bg-accent'
                              + ' text-accent-foreground'
                            : ''
                    }`}
                    disabled={disabled}
                    onClick={onClick}
                >
                    {icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {title}
            </TooltipContent>
        </Tooltip>
    );
}
