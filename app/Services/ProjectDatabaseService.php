<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Database\Connection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProjectDatabaseService
{
    protected ?Connection $connection = null;

    public function __construct(protected Project $project) {}

    public function connect(): ?Connection
    {
        if (! $this->project->hasDatabase()) {
            return null;
        }

        $connectionName = 'project_'.$this->project->id;
        $driver = $this->project->db_driver ?: 'mysql';

        config([
            "database.connections.{$connectionName}" => [
                'driver' => $driver,
                'host' => $this->project->db_host,
                'port' => $this->project->db_port,
                'database' => $this->project->db_database,
                'username' => $this->project->db_username,
                'password' => $this->project->db_password,
                'charset' => 'utf8mb4',
                'collation' => 'utf8mb4_unicode_ci',
                'prefix' => '',
                'strict' => true,
                'engine' => null,
            ],
        ]);

        $this->connection = DB::connection($connectionName);

        return $this->connection;
    }

    /**
     * @return array{connected: bool, error: string|null}
     */
    public function testConnection(): array
    {
        try {
            $connection = $this->connect();
            if (! $connection) {
                return ['connected' => false, 'error' => 'No database configuration provided'];
            }

            $connection->getPdo();

            return ['connected' => true, 'error' => null];
        } catch (\Exception $e) {
            return ['connected' => false, 'error' => $this->sanitizeErrorMessage($e->getMessage())];
        }
    }

    /**
     * Sanitize error messages to avoid exposing sensitive information.
     */
    private function sanitizeErrorMessage(string $message): string
    {
        // Common database error patterns with user-friendly messages
        $patterns = [
            '/SQLSTATE\[HY000\] \[2002\].*/' => 'Connection refused - check host and port',
            '/SQLSTATE\[HY000\] \[1045\].*/' => 'Access denied - check username and password',
            '/SQLSTATE\[HY000\] \[1049\].*/' => 'Unknown database - check database name',
            '/SQLSTATE\[HY000\] \[2005\].*/' => 'Unknown host - check hostname',
            '/SQLSTATE\[08006\].*/' => 'Connection failed - check connection settings',
            '/SQLSTATE\[.*\].*/' => 'Database connection error',
        ];

        foreach ($patterns as $pattern => $replacement) {
            if (preg_match($pattern, $message)) {
                return $replacement;
            }
        }

        // Default: return generic error without exposing details
        return 'Database connection failed';
    }

    /**
     * @return LengthAwarePaginator<object>
     */
    public function getUsers(int $perPage = 15): LengthAwarePaginator
    {
        $connection = $this->connect();

        if (! $connection) {
            return new LengthAwarePaginator([], 0, $perPage);
        }

        $table = $this->project->users_table ?: 'users';

        return $connection->table($table)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * @return LengthAwarePaginator<object>
     */
    public function getFeedbacks(int $perPage = 15): LengthAwarePaginator
    {
        $connection = $this->connect();

        if (! $connection || ! $this->project->feedbacks_table) {
            return new LengthAwarePaginator([], 0, $perPage);
        }

        return $connection->table($this->project->feedbacks_table)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * @return Collection<int, object>
     */
    public function getTables(): Collection
    {
        $connection = $this->connect();

        if (! $connection) {
            return collect();
        }

        $tables = $connection->select('SHOW TABLES');
        $key = 'Tables_in_'.$this->project->db_database;

        return collect($tables)->pluck($key);
    }

    /**
     * @return Collection<int, object>
     */
    public function getTableColumns(string $table): Collection
    {
        $connection = $this->connect();

        if (! $connection) {
            return collect();
        }

        return collect($connection->getSchemaBuilder()->getColumnListing($table));
    }

    /**
     * @return LengthAwarePaginator<object>
     */
    public function getTableData(string $table, int $perPage = 15): LengthAwarePaginator
    {
        $connection = $this->connect();

        if (! $connection) {
            return new LengthAwarePaginator([], 0, $perPage);
        }

        return $connection->table($table)
            ->paginate($perPage);
    }

    public function getTableRowCount(string $table): int
    {
        $connection = $this->connect();

        if (! $connection) {
            return 0;
        }

        return $connection->table($table)->count();
    }

    /**
     * Get foreign key relationships for a table.
     * First tries to get actual FK constraints, then falls back to naming convention.
     *
     * @return array<string, array{table: string, column: string}>
     */
    public function getTableForeignKeys(string $table): array
    {
        $connection = $this->connect();

        if (! $connection) {
            return [];
        }

        $foreignKeys = [];

        // First, try to get actual FK constraints from the database
        try {
            $results = $connection->select('
                SELECT
                    COLUMN_NAME as column_name,
                    REFERENCED_TABLE_NAME as referenced_table,
                    REFERENCED_COLUMN_NAME as referenced_column
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = ?
                    AND REFERENCED_TABLE_NAME IS NOT NULL
            ', [$this->project->db_database, $table]);

            foreach ($results as $result) {
                $foreignKeys[$result->column_name] = [
                    'table' => $result->referenced_table,
                    'column' => $result->referenced_column,
                ];
            }
        } catch (\Exception $e) {
            // Silently fail if we can't get foreign keys
        }

        // If no FK constraints found, detect by naming convention (_id columns)
        if (empty($foreignKeys)) {
            $foreignKeys = $this->detectForeignKeysByConvention($table);
        }

        return $foreignKeys;
    }

    /**
     * Detect foreign keys by naming convention (columns ending in _id).
     *
     * @return array<string, array{table: string, column: string}>
     */
    private function detectForeignKeysByConvention(string $table): array
    {
        $connection = $this->connect();

        if (! $connection) {
            return [];
        }

        $foreignKeys = [];
        $columns = $this->getTableColumns($table);
        $availableTables = $this->getTables()->toArray();

        foreach ($columns as $column) {
            // Check if column ends with _id
            if (! str_ends_with($column, '_id') || $column === 'id') {
                continue;
            }

            // Extract potential table name (e.g., user_id -> users, category_id -> categories)
            $baseName = substr($column, 0, -3); // Remove '_id'

            // Try common pluralization patterns
            $possibleTables = [
                $baseName.'s',           // user -> users
                $baseName.'es',          // box -> boxes
                $baseName,               // exact match (singular table names)
                rtrim($baseName, 'y').'ies', // category -> categories
            ];

            foreach ($possibleTables as $possibleTable) {
                if (in_array($possibleTable, $availableTables, true)) {
                    $foreignKeys[$column] = [
                        'table' => $possibleTable,
                        'column' => 'id',
                    ];
                    break;
                }
            }
        }

        return $foreignKeys;
    }

    /**
     * Get a single row from a table by its primary key value.
     */
    public function getTableRow(string $table, string $column, mixed $value): ?object
    {
        $connection = $this->connect();

        if (! $connection) {
            return null;
        }

        return $connection->table($table)->where($column, $value)->first();
    }

    /**
     * Get the primary key column for a table.
     */
    public function getPrimaryKey(string $table): ?string
    {
        $connection = $this->connect();

        if (! $connection) {
            return null;
        }

        try {
            $results = $connection->select("
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = ?
                    AND CONSTRAINT_NAME = 'PRIMARY'
                LIMIT 1
            ", [$this->project->db_database, $table]);

            return $results[0]->COLUMN_NAME ?? null;
        } catch (\Exception $e) {
            return 'id'; // Default to 'id' if we can't determine
        }
    }

    public function disconnect(): void
    {
        if ($this->connection) {
            $connectionName = 'project_'.$this->project->id;
            DB::purge($connectionName);
            $this->connection = null;
        }
    }
}
