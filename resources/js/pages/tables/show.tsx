import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import AppLayout from '@/layouts/app-layout';
import {
    index as tablesIndex,
    show as showTable,
    pin,
    unpin,
} from '@/actions/App/Http/Controllers/TableController';
import { create as createProject } from '@/actions/App/Http/Controllers/ProjectController';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Database,
    ExternalLink,
    Pin,
    PinOff,
    Table2,
    Search,
    X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface PaginatedData {
    data: Record<string, unknown>[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
}

interface ForeignKey {
    table: string;
    column: string;
}

interface Filters {
    search?: string;
    sort?: string;
    direction?: 'asc' | 'desc';
}

interface Props {
    table: string;
    data: PaginatedData;
    columns: string[];
    foreignKeys: Record<string, ForeignKey>;
    hasDatabase: boolean;
    isPinned: boolean;
    filters: Filters;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '-';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return new Date(value).toLocaleDateString();
    }
    const str = String(value);
    return str.length > 100 ? str.substring(0, 100) + '...' : str;
}

export default function TableShow({
    table,
    data,
    columns,
    foreignKeys,
    hasDatabase,
    isPinned: initialIsPinned,
    filters,
}: Props) {
    const { currentProject } = usePage<SharedData>().props;
    const [isPinned, setIsPinned] = useState(initialIsPinned);
    const [pinning, setPinning] = useState(false);
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [selectedRecord, setSelectedRecord] = useState<Record<
        string,
        unknown
    > | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const renderCellValue = (column: string, value: unknown) => {
        const fk = foreignKeys[column];
        const displayValue = formatValue(value);

        if (fk && value !== null && value !== undefined) {
            return (
                <Link
                    href={`/tables/${fk.table}?search=${value}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                    {displayValue}
                    <ExternalLink className="size-3" />
                </Link>
            );
        }

        return <span>{displayValue}</span>;
    };

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Tables',
            href: tablesIndex().url,
        },
        {
            title: table,
            href: showTable.url(table),
        },
    ];

    const getCsrfToken = (): string => {
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const handleTogglePin = async () => {
        setPinning(true);

        try {
            const url = isPinned ? unpin.url(table) : pin.url(table);
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
            });

            const result = await response.json();

            if (result.success) {
                setIsPinned(!isPinned);
                router.reload({ only: ['currentProject'] });
            }
        } catch (error) {
            console.error('Failed to toggle pin:', error);
        } finally {
            setPinning(false);
        }
    };

    const handleSort = (column: string) => {
        const newDirection =
            filters.sort === column && filters.direction === 'asc'
                ? 'desc'
                : 'asc';

        router.get(
            showTable.url(table),
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

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            router.get(
                showTable.url(table),
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

    const handleRowClick = (row: Record<string, unknown>) => {
        setSelectedRecord(row);
        setSheetOpen(true);
    };

    const getSortIcon = (column: string) => {
        if (filters.sort !== column) {
            return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
        }
        return filters.direction === 'asc' ? (
            <ArrowUp className="ml-2 size-4" />
        ) : (
            <ArrowDown className="ml-2 size-4" />
        );
    };

    if (!hasDatabase) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`Table: ${table}`} />
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
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Table: ${table}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4">
                <div className="flex shrink-0 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={tablesIndex().url}>
                                <ArrowLeft className="mr-2 size-4" />
                                Back
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <Table2 className="size-6 text-muted-foreground" />
                            <div>
                                <h1 className="text-2xl font-bold">{table}</h1>
                                <p className="text-muted-foreground">
                                    {data.total.toLocaleString()} rows ·{' '}
                                    {columns.length} columns
                                </p>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant={isPinned ? 'secondary' : 'outline'}
                        onClick={handleTogglePin}
                        disabled={pinning}
                    >
                        {isPinned ? (
                            <>
                                <PinOff className="mr-2 size-4" />
                                Unpin from Sidebar
                            </>
                        ) : (
                            <>
                                <Pin className="mr-2 size-4" />
                                Pin to Sidebar
                            </>
                        )}
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="flex shrink-0 items-center gap-2">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search across all columns..."
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
                </div>

                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-background">
                                <tr className="border-b border-sidebar-border/70 dark:border-sidebar-border">
                                    {columns.map((column) => (
                                        <th
                                            key={column}
                                            className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium capitalize text-muted-foreground"
                                        >
                                            <button
                                                onClick={() =>
                                                    handleSort(column)
                                                }
                                                className="flex items-center hover:text-foreground"
                                            >
                                                {column.replace(/_/g, ' ')}
                                                {getSortIcon(column)}
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={columns.length}
                                            className="px-4 py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm
                                                ? 'No results found for your search.'
                                                : 'No data found in this table.'}
                                        </td>
                                    </tr>
                                ) : (
                                    data.data.map((row, index) => (
                                        <tr
                                            key={index}
                                            onClick={() => handleRowClick(row)}
                                            className="cursor-pointer border-b border-sidebar-border/70 last:border-0 hover:bg-muted/50 dark:border-sidebar-border"
                                        >
                                            {columns.map((column) => (
                                                <td
                                                    key={column}
                                                    className="whitespace-nowrap px-4 py-3 text-sm"
                                                >
                                                    {renderCellValue(
                                                        column,
                                                        row[column],
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data.last_page > 1 && (
                        <div className="flex shrink-0 items-center justify-between border-t border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            <div className="text-sm text-muted-foreground">
                                Showing {data.from} to {data.to} of{' '}
                                {data.total} results
                            </div>
                            <div className="flex gap-2">
                                {data.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        className={`rounded px-3 py-1 text-sm ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground'
                                                : link.url
                                                  ? 'hover:bg-muted'
                                                  : 'cursor-not-allowed opacity-50'
                                        }`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Record Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle>Record Details</SheetTitle>
                        <SheetDescription>
                            View detailed information for this record
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                        {selectedRecord &&
                            columns.map((column) => {
                                const value = selectedRecord[column];
                                const fk = foreignKeys[column];

                                return (
                                    <div
                                        key={column}
                                        className="rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border"
                                    >
                                        <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                                            {column.replace(/_/g, ' ')}
                                        </div>
                                        <div className="break-words text-sm">
                                            {fk &&
                                            value !== null &&
                                            value !== undefined ? (
                                                <Link
                                                    href={`/tables/${fk.table}?search=${value}`}
                                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                                >
                                                    {formatValue(value)}
                                                    <ExternalLink className="size-3" />
                                                </Link>
                                            ) : value === null ||
                                              value === undefined ? (
                                                <span className="text-muted-foreground">
                                                    -
                                                </span>
                                            ) : typeof value === 'boolean' ? (
                                                <span>
                                                    {value ? 'Yes' : 'No'}
                                                </span>
                                            ) : typeof value === 'object' ? (
                                                <pre className="whitespace-pre-wrap text-xs">
                                                    {JSON.stringify(
                                                        value,
                                                        null,
                                                        2,
                                                    )}
                                                </pre>
                                            ) : (
                                                <span>{String(value)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
