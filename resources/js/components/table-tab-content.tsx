import { useTableTabs } from '@/contexts/table-tabs-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { data as tableData, update as updateRecord } from '@/actions/App/Http/Controllers/TableController';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Check,
    Copy,
    ExternalLink,
    Pencil,
    RefreshCw,
    Save,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

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

interface TabData {
    table: string;
    data: PaginatedData;
    columns: string[];
    foreignKeys: Record<string, ForeignKey>;
    primaryKey: string;
}

interface TabState {
    data: TabData | null;
    isLoading: boolean;
    error: string | null;
    search: string;
    sort: string | null;
    direction: 'asc' | 'desc';
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

function formatFullValue(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return String(value);
}

interface ContextMenuState {
    isOpen: boolean;
    x: number;
    y: number;
    column: string | null;
    value: unknown;
}

function RecordSidebar({
    record,
    columns,
    foreignKeys,
    tableName,
    primaryKey,
    onClose,
    onOpenTable,
    onRecordUpdated,
}: {
    record: Record<string, unknown>;
    columns: string[];
    foreignKeys: Record<string, ForeignKey>;
    tableName: string;
    primaryKey: string;
    onClose: () => void;
    onOpenTable: (name: string) => void;
    onRecordUpdated: (updatedRecord: Record<string, unknown>) => void;
}) {
    const [copied, setCopied] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, string>>(() => {
        const initialValues: Record<string, string> = {};
        columns.forEach((col) => {
            const value = record[col];
            if (value === null || value === undefined) {
                initialValues[col] = '';
            } else if (typeof value === 'object') {
                initialValues[col] = JSON.stringify(value, null, 2);
            } else {
                initialValues[col] = String(value);
            }
        });
        return initialValues;
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        x: 0,
        y: 0,
        column: null,
        value: null,
    });

    const getCsrfToken = (): string => {
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    // Update editedValues when record changes
    useEffect(() => {
        const newValues: Record<string, string> = {};
        columns.forEach((col) => {
            const value = record[col];
            if (value === null || value === undefined) {
                newValues[col] = '';
            } else if (typeof value === 'object') {
                newValues[col] = JSON.stringify(value, null, 2);
            } else {
                newValues[col] = String(value);
            }
        });
        setEditedValues(newValues);
    }, [record, columns]);

    const handleFieldChange = (column: string, value: string) => {
        setEditedValues((prev) => ({
            ...prev,
            [column]: value,
        }));
    };

    const handleSave = useCallback(async () => {
        if (isSaving) return;

        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            const dataToSave: Record<string, unknown> = {};
            columns.forEach((col) => {
                if (col === primaryKey) return;

                const editedValue = editedValues[col];
                const originalValue = record[col];

                // Try to parse JSON if it looks like JSON
                if (editedValue && (editedValue.startsWith('{') || editedValue.startsWith('['))) {
                    try {
                        dataToSave[col] = JSON.parse(editedValue);
                    } catch {
                        dataToSave[col] = editedValue;
                    }
                } else if (editedValue === '' && originalValue !== '') {
                    dataToSave[col] = null;
                } else if (editedValue === 'NULL' || editedValue === 'null') {
                    dataToSave[col] = null;
                } else {
                    dataToSave[col] = editedValue;
                }
            });

            const response = await fetch(updateRecord.url(tableName), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    id: record[primaryKey],
                    data: dataToSave,
                }),
            });

            const result = await response.json();

            if (result.success) {
                const updatedRecord = { ...record };
                columns.forEach((col) => {
                    if (col !== primaryKey) {
                        const editedValue = editedValues[col];
                        if (editedValue && (editedValue.startsWith('{') || editedValue.startsWith('['))) {
                            try {
                                updatedRecord[col] = JSON.parse(editedValue);
                            } catch {
                                updatedRecord[col] = editedValue;
                            }
                        } else if (editedValue === '' || editedValue === 'NULL' || editedValue === 'null') {
                            updatedRecord[col] = null;
                        } else {
                            updatedRecord[col] = editedValue;
                        }
                    }
                });
                onRecordUpdated(updatedRecord);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            } else {
                setError(result.message || 'Failed to update record');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update record');
        } finally {
            setIsSaving(false);
        }
    }, [columns, editedValues, isSaving, onRecordUpdated, primaryKey, record, tableName]);

    // Keyboard shortcut for Ctrl+S
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu((prev) => ({ ...prev, isOpen: false }));
        if (contextMenu.isOpen) {
            window.addEventListener('click', handleClick);
            return () => window.removeEventListener('click', handleClick);
        }
    }, [contextMenu.isOpen]);

    const handleContextMenu = (e: React.MouseEvent, column: string, value: unknown) => {
        e.preventDefault();
        setContextMenu({
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            column,
            value,
        });
    };

    const handleCopyAll = async () => {
        const formattedData = columns.reduce(
            (acc, col) => {
                acc[col] = record[col];
                return acc;
            },
            {} as Record<string, unknown>,
        );

        try {
            await navigator.clipboard.writeText(
                JSON.stringify(formattedData, null, 2),
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };

    const handleCopyField = async (value: unknown) => {
        try {
            await navigator.clipboard.writeText(formatFullValue(value));
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };

    const handleCopyFieldName = async (column: string) => {
        try {
            await navigator.clipboard.writeText(column);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };

    const handleSetNull = (column: string) => {
        setEditedValues((prev) => ({ ...prev, [column]: '' }));
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };

    const handleResetField = (column: string) => {
        const value = record[column];
        let resetValue = '';
        if (value !== null && value !== undefined) {
            if (typeof value === 'object') {
                resetValue = JSON.stringify(value, null, 2);
            } else {
                resetValue = String(value);
            }
        }
        setEditedValues((prev) => ({ ...prev, [column]: resetValue }));
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };

    return (
        <div
            className="flex h-full w-[420px] shrink-0 flex-col border-l border-sidebar-border/70 bg-background dark:border-sidebar-border"
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border/70 px-3 py-2 dark:border-sidebar-border">
                <span className="text-sm font-medium">Record Details</span>
                <div className="flex items-center gap-1">
                    <Button
                        variant={saveSuccess ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {saveSuccess ? (
                            <>
                                <Check className="size-3" />
                                Saved
                            </>
                        ) : (
                            <>
                                <Save className="size-3" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={handleCopyAll}
                    >
                        {copied ? (
                            <>
                                <Check className="size-3" />
                                Copied
                            </>
                        ) : (
                            <>
                                <Copy className="size-3" />
                                Copy
                            </>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={onClose}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Status bar */}
            {error && (
                <div className="shrink-0 border-b border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                </div>
            )}

            <div className="shrink-0 border-b border-sidebar-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground dark:border-sidebar-border">
                Press <kbd className="rounded bg-muted px-1 font-mono">Ctrl+S</kbd> to save • Right-click for options
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-3">
                    {columns.map((column) => {
                        const value = record[column];
                        const fk = foreignKeys[column];
                        const displayValue = formatFullValue(value);
                        const isLongValue = displayValue.length > 50;
                        const isPrimaryKey = column === primaryKey;
                        const editedValue = editedValues[column] ?? '';
                        const isJsonValue =
                            typeof value === 'object' ||
                            (typeof value === 'string' &&
                                (value.startsWith('{') || value.startsWith('[')));

                        return (
                            <div
                                key={column}
                                className="rounded border border-sidebar-border/70 p-2 dark:border-sidebar-border"
                                onContextMenu={(e) => handleContextMenu(e, column, value)}
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase text-muted-foreground">
                                        {column.replace(/_/g, ' ')}
                                        {isPrimaryKey && (
                                            <span className="ml-1 text-primary">(PK)</span>
                                        )}
                                        {fk && (
                                            <button
                                                onClick={() => onOpenTable(fk.table)}
                                                className="ml-1 text-primary hover:underline"
                                                title={`Go to ${fk.table}`}
                                            >
                                                <ExternalLink className="inline size-3" />
                                            </button>
                                        )}
                                    </span>
                                </div>
                                {isPrimaryKey ? (
                                    <div className="text-sm text-muted-foreground">
                                        {displayValue}
                                    </div>
                                ) : isJsonValue || isLongValue ? (
                                    <textarea
                                        value={editedValue}
                                        onChange={(e) =>
                                            handleFieldChange(column, e.target.value)
                                        }
                                        className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                                        rows={Math.min(
                                            10,
                                            Math.max(3, editedValue.split('\n').length),
                                        )}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={editedValue}
                                        onChange={(e) =>
                                            handleFieldChange(column, e.target.value)
                                        }
                                        className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                        placeholder="NULL"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu.isOpen && (
                <div
                    className="fixed z-50 min-w-48 rounded-md border border-sidebar-border/70 bg-background py-1 shadow-lg dark:border-sidebar-border"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        onClick={() => handleCopyField(contextMenu.value)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                    >
                        <Copy className="size-4" />
                        Copy Value
                    </button>
                    <button
                        onClick={() => handleCopyFieldName(contextMenu.column!)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                    >
                        <Copy className="size-4" />
                        Copy Field Name
                    </button>
                    <button
                        onClick={handleCopyAll}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                    >
                        <Copy className="size-4" />
                        Copy All Fields
                    </button>
                    <div className="my-1 border-t border-sidebar-border/70 dark:border-sidebar-border" />
                    {contextMenu.column !== primaryKey && (
                        <>
                            <button
                                onClick={() => handleSetNull(contextMenu.column!)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                            >
                                <X className="size-4" />
                                Set to NULL
                            </button>
                            <button
                                onClick={() => handleResetField(contextMenu.column!)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                            >
                                <RefreshCw className="size-4" />
                                Reset to Original
                            </button>
                        </>
                    )}
                    <div className="my-1 border-t border-sidebar-border/70 dark:border-sidebar-border" />
                    <button
                        onClick={handleSave}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                    >
                        <Save className="size-4" />
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    );
}

function TableContent({
    tableName,
    isActive,
    onOpenTable,
}: {
    tableName: string;
    isActive: boolean;
    onOpenTable: (name: string) => void;
}) {
    const [state, setState] = useState<TabState>({
        data: null,
        isLoading: true,
        error: null,
        search: '',
        sort: null,
        direction: 'desc',
    });
    const [selectedRecord, setSelectedRecord] = useState<Record<
        string,
        unknown
    > | null>(null);

    const fetchData = useCallback(
        async (
            search?: string,
            sort?: string | null,
            direction?: 'asc' | 'desc',
            page?: number,
        ) => {
            setState((prev) => ({ ...prev, isLoading: true }));

            try {
                const params = new URLSearchParams();
                if (search) params.set('search', search);
                if (sort) params.set('sort', sort);
                if (direction) params.set('direction', direction);
                if (page) params.set('page', String(page));

                const url = `${tableData.url(tableName)}?${params.toString()}`;
                const response = await fetch(url, {
                    headers: {
                        Accept: 'application/json',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch table data');
                }

                const result = await response.json();

                setState((prev) => ({
                    ...prev,
                    data: {
                        table: tableName,
                        data: result.data,
                        columns: result.columns,
                        foreignKeys: result.foreignKeys,
                        primaryKey: result.primaryKey || 'id',
                    },
                    isLoading: false,
                    error: null,
                }));
            } catch (err) {
                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: err instanceof Error ? err.message : 'Unknown error',
                }));
            }
        },
        [tableName],
    );

    useEffect(() => {
        if (isActive && !state.data) {
            fetchData();
        }
    }, [isActive, state.data, fetchData]);

    const handleSearch = (value: string) => {
        setState((prev) => ({ ...prev, search: value }));
    };

    useEffect(() => {
        if (!state.data) return;

        const timer = setTimeout(() => {
            fetchData(state.search, state.sort, state.direction);
        }, 300);

        return () => clearTimeout(timer);
    }, [state.search]);

    const handleSort = (column: string) => {
        const newDirection =
            state.sort === column && state.direction === 'asc' ? 'desc' : 'asc';

        setState((prev) => ({
            ...prev,
            sort: column,
            direction: newDirection,
        }));

        fetchData(state.search, column, newDirection);
    };

    const handlePageChange = (url: string | null) => {
        if (!url) return;

        const urlObj = new URL(url, window.location.origin);
        const page = urlObj.searchParams.get('page');

        if (page) {
            fetchData(state.search, state.sort, state.direction, parseInt(page));
        }
    };

    const handleRowClick = (row: Record<string, unknown>) => {
        setSelectedRecord(row);
    };

    const getSortIcon = (column: string) => {
        if (state.sort !== column) {
            return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
        }
        return state.direction === 'asc' ? (
            <ArrowUp className="ml-2 size-4" />
        ) : (
            <ArrowDown className="ml-2 size-4" />
        );
    };

    const renderCellValue = (column: string, value: unknown) => {
        const fk = state.data?.foreignKeys[column];
        const displayValue = formatValue(value);

        if (fk && value !== null && value !== undefined) {
            return (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenTable(fk.table);
                    }}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                    {displayValue}
                    <ExternalLink className="size-3" />
                </button>
            );
        }

        return <span>{displayValue}</span>;
    };

    if (state.isLoading && !state.data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-destructive">{state.error}</div>
            </div>
        );
    }

    if (!state.data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    const { data, columns, foreignKeys, primaryKey } = state.data;

    return (
        <div className="flex h-full overflow-hidden">
            {/* Main Table Area */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Search Bar */}
                <div className="flex shrink-0 items-center gap-2 border-b border-sidebar-border/70 p-2 dark:border-sidebar-border">
                    <div className="relative max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search across all columns..."
                            value={state.search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="h-8 pl-9 pr-9 text-sm"
                        />
                        {state.search && (
                            <button
                                onClick={() => handleSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2"
                        onClick={() => fetchData(state.search, state.sort, state.direction)}
                        disabled={state.isLoading}
                    >
                        <RefreshCw className={`size-4 ${state.isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        {data.total.toLocaleString()} rows
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-background">
                            <tr className="border-b border-sidebar-border/70 dark:border-sidebar-border">
                                {columns.map((column) => (
                                    <th
                                        key={column}
                                        className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium capitalize text-muted-foreground"
                                    >
                                        <button
                                            onClick={() => handleSort(column)}
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
                                        className="px-3 py-8 text-center text-muted-foreground"
                                    >
                                        {state.search
                                            ? 'No results found for your search.'
                                            : 'No data found in this table.'}
                                    </td>
                                </tr>
                            ) : (
                                data.data.map((row, index) => (
                                    <tr
                                        key={index}
                                        onClick={() => handleRowClick(row)}
                                        className={`cursor-pointer border-b border-sidebar-border/70 last:border-0 hover:bg-muted/50 dark:border-sidebar-border ${
                                            selectedRecord === row
                                                ? 'bg-muted/70'
                                                : ''
                                        }`}
                                    >
                                        {columns.map((column) => (
                                            <td
                                                key={column}
                                                className="whitespace-nowrap px-3 py-2 text-xs"
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

                {/* Pagination */}
                {data.last_page > 1 && (
                    <div className="flex shrink-0 items-center justify-between border-t border-sidebar-border/70 px-3 py-2 dark:border-sidebar-border">
                        <div className="text-xs text-muted-foreground">
                            {data.from} - {data.to} of {data.total}
                        </div>
                        <div className="flex gap-1">
                            {data.links.map((link, index) => (
                                <button
                                    key={index}
                                    onClick={() => handlePageChange(link.url)}
                                    disabled={!link.url}
                                    className={`rounded px-2 py-1 text-xs ${
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

            {/* Record Sidebar */}
            {selectedRecord && (
                <RecordSidebar
                    record={selectedRecord}
                    columns={columns}
                    foreignKeys={foreignKeys}
                    tableName={tableName}
                    primaryKey={primaryKey}
                    onClose={() => setSelectedRecord(null)}
                    onOpenTable={onOpenTable}
                    onRecordUpdated={(updatedRecord) => {
                        setSelectedRecord(updatedRecord);
                        // Also update the record in the data list
                        setState((prev) => {
                            if (!prev.data) return prev;
                            const newData = prev.data.data.data.map((row) =>
                                row[primaryKey] === updatedRecord[primaryKey]
                                    ? updatedRecord
                                    : row,
                            );
                            return {
                                ...prev,
                                data: {
                                    ...prev.data,
                                    data: {
                                        ...prev.data.data,
                                        data: newData,
                                    },
                                },
                            };
                        });
                    }}
                />
            )}
        </div>
    );
}

export function TableTabContent() {
    const { tabs, activeTabId, openTab } = useTableTabs();

    if (tabs.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                Select a table from the sidebar to view its data
            </div>
        );
    }

    return (
        <div className="relative h-full">
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                    <div
                        key={tab.id}
                        className="absolute inset-0"
                        style={{
                            visibility: isActive ? 'visible' : 'hidden',
                            zIndex: isActive ? 1 : 0,
                        }}
                    >
                        <TableContent
                            tableName={tab.name}
                            isActive={isActive}
                            onOpenTable={openTab}
                        />
                    </div>
                );
            })}
        </div>
    );
}
