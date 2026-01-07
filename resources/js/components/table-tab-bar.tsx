import { useTableTabs, type TableTab } from '@/contexts/table-tabs-context';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TabItemProps {
    tab: TableTab;
    isActive: boolean;
    onActivate: () => void;
    onClose: (e: React.MouseEvent) => void;
}

function TabItem({ tab, isActive, onActivate, onClose }: TabItemProps) {
    return (
        <button
            onClick={onActivate}
            className={cn(
                'group flex h-9 items-center gap-2 border-r border-sidebar-border/70 px-3 text-sm transition-colors dark:border-sidebar-border',
                isActive
                    ? 'bg-background text-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            <span className="max-w-32 truncate">{tab.name}</span>
            <span
                role="button"
                onClick={onClose}
                className={cn(
                    'flex size-4 items-center justify-center rounded hover:bg-muted-foreground/20',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
            >
                <X className="size-3" />
            </span>
        </button>
    );
}

export function TableTabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab } = useTableTabs();

    if (tabs.length === 0) {
        return null;
    }

    return (
        <div className="flex shrink-0 items-center overflow-x-auto border-b border-sidebar-border/70 bg-muted/30 dark:border-sidebar-border">
            {tabs.map((tab) => (
                <TabItem
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    onActivate={() => setActiveTab(tab.id)}
                    onClose={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                    }}
                />
            ))}
        </div>
    );
}
