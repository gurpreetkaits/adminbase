import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { index as tablesIndex, show as showTable, record as recordRoute } from '@/actions/App/Http/Controllers/TableController';
import { create as createProject } from '@/actions/App/Http/Controllers/ProjectController';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Database, ExternalLink, FileText } from 'lucide-react';

interface ForeignKey {
    table: string;
    column: string;
}

interface Props {
    table: string;
    record: Record<string, unknown>;
    recordId: string;
    columns: string[];
    foreignKeys: Record<string, ForeignKey>;
    primaryKey: string;
    hasDatabase: boolean;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '-';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return new Date(value).toLocaleString();
    }
    return String(value);
}

export default function TableRecord({ table, record, recordId, columns, foreignKeys, primaryKey, hasDatabase }: Props) {
    const { currentProject } = usePage<SharedData>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Tables',
            href: tablesIndex().url,
        },
        {
            title: table,
            href: showTable.url(table),
        },
        {
            title: `Record #${recordId}`,
            href: recordRoute.url({ table, id: recordId }),
        },
    ];

    const renderFieldValue = (column: string, value: unknown) => {
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
                    <span className="text-xs text-muted-foreground">({fk.table})</span>
                </Link>
            );
        }

        // Check if value is long text or JSON
        if (typeof value === 'object' || (typeof value === 'string' && value.length > 100)) {
            return (
                <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-sm">
                    {displayValue}
                </pre>
            );
        }

        return <span>{displayValue}</span>;
    };

    if (!hasDatabase) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`Record: ${table}#${recordId}`} />
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
            <Head title={`Record: ${table}#${recordId}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4">
                <div className="flex shrink-0 items-center gap-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={showTable.url(table)}>
                            <ArrowLeft className="mr-2 size-4" />
                            Back to {table}
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <FileText className="size-6 text-muted-foreground" />
                        <div>
                            <h1 className="text-2xl font-bold">{table} #{recordId}</h1>
                            <p className="text-muted-foreground">
                                {columns.length} fields
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <div className="divide-y divide-sidebar-border/70 dark:divide-sidebar-border">
                        {columns.map((column) => {
                            const fk = foreignKeys[column];
                            return (
                                <div
                                    key={column}
                                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start"
                                >
                                    <div className="w-48 shrink-0">
                                        <span className="font-medium capitalize text-muted-foreground">
                                            {column.replace(/_/g, ' ')}
                                        </span>
                                        {column === primaryKey && (
                                            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                                PK
                                            </span>
                                        )}
                                        {fk && (
                                            <span className="ml-2 rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-500">
                                                FK
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 break-all">
                                        {renderFieldValue(column, record[column])}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
