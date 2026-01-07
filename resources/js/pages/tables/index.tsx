import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableTabBar } from '@/components/table-tab-bar';
import { TableTabContent } from '@/components/table-tab-content';
import {
    TableTabsProvider,
    useTableTabs,
} from '@/contexts/table-tabs-context';
import AppLayout from '@/layouts/app-layout';
import {
    index as tablesIndex,
    pin,
    unpin,
} from '@/actions/App/Http/Controllers/TableController';
import { create as createProject } from '@/actions/App/Http/Controllers/ProjectController';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Database,
    Pin,
    PinOff,
    Search,
    X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Tables',
        href: tablesIndex().url,
    },
];

interface TableInfo {
    name: string;
    row_count: number;
    is_pinned: boolean;
}

interface Filters {
    search?: string;
    sort?: string;
    direction?: 'asc' | 'desc';
}

interface Props {
    tables: TableInfo[];
    hasDatabase: boolean;
    pinnedTables: string[];
    filters: Filters;
    openTab?: string;
}

function TablesContent({
    tables,
    hasDatabase,
    pinnedTables: initialPinnedTables,
    filters,
    openTab: initialOpenTab,
}: Props) {
    const { currentProject } = usePage<SharedData>().props;
    const { openTab, tabs } = useTableTabs();
    const [pinnedTables, setPinnedTables] = useState<string[]>(
        initialPinnedTables,
    );
    const [pinning, setPinning] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [lastOpenedTab, setLastOpenedTab] = useState<string | null>(null);

    // Open tab from URL parameter when it changes
    useEffect(() => {
        if (initialOpenTab && initialOpenTab !== lastOpenedTab) {
            openTab(initialOpenTab);
            setLastOpenedTab(initialOpenTab);
        }
    }, [initialOpenTab, lastOpenedTab, openTab]);

    const getCsrfToken = (): string => {
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const handleTogglePin = async (
        e: React.MouseEvent,
        tableName: string,
        isPinned: boolean,
    ) => {
        e.stopPropagation();
        setPinning(tableName);

        try {
            const url = isPinned ? unpin.url(tableName) : pin.url(tableName);
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
            });

            const data = await response.json();

            if (data.success) {
                setPinnedTables(data.pinned_tables);
                router.reload({ only: ['currentProject'] });
            }
        } catch (error) {
            console.error('Failed to toggle pin:', error);
        } finally {
            setPinning(null);
        }
    };

    const handleSort = (column: string) => {
        const newDirection =
            filters.sort === column && filters.direction === 'asc'
                ? 'desc'
                : 'asc';

        router.get(
            tablesIndex().url,
            {
                search: searchTerm || undefined,
                sort: column,
                direction: newDirection,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            router.get(
                tablesIndex().url,
                {
                    search: searchTerm || undefined,
                    sort: filters.sort,
                    direction: filters.direction,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const getSortIcon = (column: string) => {
        if (filters.sort !== column) {
            return <ArrowUpDown className="ml-1 size-3 text-muted-foreground" />;
        }
        return filters.direction === 'asc' ? (
            <ArrowUp className="ml-1 size-3" />
        ) : (
            <ArrowDown className="ml-1 size-3" />
        );
    };

    const handleOpenTable = (tableName: string) => {
        openTab(tableName);
    };

    if (!hasDatabase) {
        return (
            <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-4">
                <div className="rounded-xl border border-sidebar-border/70 p-8 text-center dark:border-sidebar-border">
                    <Database className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <h2 className="mb-2 text-xl font-semibold">
                        No Database Connected
                    </h2>
                    <p className="mb-4 text-muted-foreground">
                        {currentProject?.name} doesn't have a database
                        connection configured.
                    </p>
                    <Button asChild>
                        <Link href={createProject().url}>
                            Configure Database
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    // If tabs are open, show the tabbed view
    if (tabs.length > 0) {
        return (
            <div className="flex h-full flex-1 flex-col overflow-hidden">
                <TableTabBar />
                <div className="flex-1 overflow-hidden">
                    <TableTabContent />
                </div>
            </div>
        );
    }

    // Otherwise show the table listing
    return (
        <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4">
            {/* Header with search */}
            <div className="flex shrink-0 items-center justify-between gap-4">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search tables..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-9 pr-9"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => handleSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
                <div className="text-sm text-muted-foreground">
                    {tables.length} tables
                </div>
            </div>

            {/* Compact Table */}
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                <div className="flex-1 overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-background">
                            <tr className="border-b border-sidebar-border/70 dark:border-sidebar-border">
                                <th className="w-10 px-3 py-2 text-left"></th>
                                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                                    <button
                                        onClick={() => handleSort('name')}
                                        className="flex items-center hover:text-foreground"
                                    >
                                        Name
                                        {getSortIcon('name')}
                                    </button>
                                </th>
                                <th className="px-3 py-2 text-right text-sm font-medium text-muted-foreground">
                                    <button
                                        onClick={() => handleSort('row_count')}
                                        className="ml-auto flex items-center hover:text-foreground"
                                    >
                                        Rows
                                        {getSortIcon('row_count')}
                                    </button>
                                </th>
                                <th className="w-16 px-3 py-2 text-right"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tables.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-3 py-8 text-center text-muted-foreground"
                                    >
                                        {searchTerm
                                            ? 'No tables found matching your search.'
                                            : 'No tables found in database.'}
                                    </td>
                                </tr>
                            ) : (
                                tables.map((table) => {
                                    const isPinned = pinnedTables.includes(
                                        table.name,
                                    );
                                    return (
                                        <tr
                                            key={table.name}
                                            className="group cursor-pointer border-b border-sidebar-border/70 last:border-0 hover:bg-muted/50 dark:border-sidebar-border"
                                            onClick={() =>
                                                handleOpenTable(table.name)
                                            }
                                        >
                                            <td className="px-3 py-2">
                                                {isPinned && (
                                                    <Pin className="size-3.5 text-muted-foreground" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-sm font-medium">
                                                {table.name}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                                                {table.row_count.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="size-7 p-0 opacity-0 group-hover:opacity-100"
                                                    onClick={(e) =>
                                                        handleTogglePin(
                                                            e,
                                                            table.name,
                                                            isPinned,
                                                        )
                                                    }
                                                    disabled={
                                                        pinning === table.name
                                                    }
                                                >
                                                    {isPinned ? (
                                                        <PinOff className="size-3.5" />
                                                    ) : (
                                                        <Pin className="size-3.5" />
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function TablesIndex(props: Props) {
    return (
        <TableTabsProvider>
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Tables" />
                <TablesContent {...props} />
            </AppLayout>
        </TableTabsProvider>
    );
}
