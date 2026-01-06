import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { index as tablesIndex, show as showTable, pin, unpin, record as recordRoute } from '@/actions/App/Http/Controllers/TableController';
import { create as createProject } from '@/actions/App/Http/Controllers/ProjectController';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Database, ExternalLink, Pin, PinOff, Table2 } from 'lucide-react';
import { useState } from 'react';

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

interface Props {
    table: string;
    data: PaginatedData;
    columns: string[];
    foreignKeys: Record<string, ForeignKey>;
    hasDatabase: boolean;
    isPinned: boolean;
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

export default function TableShow({ table, data, columns, foreignKeys, hasDatabase, isPinned: initialIsPinned }: Props) {
    const { currentProject } = usePage<SharedData>().props;
    const [isPinned, setIsPinned] = useState(initialIsPinned);

    const renderCellValue = (column: string, value: unknown) => {
        const fk = foreignKeys[column];
        const displayValue = formatValue(value);

        if (fk && value !== null && value !== undefined) {
            return (
                <Link
                    href={recordRoute.url({ table: fk.table, id: String(value) })}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                    {displayValue}
                    <ExternalLink className="size-3" />
                </Link>
            );
        }

        return <span>{displayValue}</span>;
    };
    const [pinning, setPinning] = useState(false);

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
                    'Accept': 'application/json',
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

    if (!hasDatabase) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`Table: ${table}`} />
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-4">
                    <div className="rounded-xl border border-sidebar-border/70 p-8 text-center dark:border-sidebar-border">
                        <Database className="mx-auto mb-4 size-12 text-muted-foreground" />
                        <h2 className="mb-2 text-xl font-semibold">No Database Connected</h2>
                        <p className="mb-4 text-muted-foreground">
                            {currentProject?.name} doesn't have a database connection configured.
                        </p>
                        <Button asChild>
                            <Link href={createProject().url}>Configure Database</Link>
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
                                    {data.total.toLocaleString()} rows · {columns.length} columns
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
                                            {column.replace(/_/g, ' ')}
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
                                            No data found in this table.
                                        </td>
                                    </tr>
                                ) : (
                                    data.data.map((row, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                        >
                                            {columns.map((column) => (
                                                <td key={column} className="whitespace-nowrap px-4 py-3 text-sm">
                                                    {renderCellValue(column, row[column])}
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
                                Showing {data.from} to {data.to} of {data.total} results
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
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
