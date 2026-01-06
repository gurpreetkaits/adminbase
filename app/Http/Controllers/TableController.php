<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\ProjectDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TableController extends Controller
{
    public function index(Request $request): Response
    {
        $project = Project::find($request->session()->get('current_project_id'));

        $tables = [];
        $hasDatabase = false;

        if ($project && $project->hasDatabase()) {
            $hasDatabase = true;
            $dbService = new ProjectDatabaseService($project);

            $result = $dbService->testConnection();
            if ($result['connected']) {
                $tableNames = $dbService->getTables();

                foreach ($tableNames as $tableName) {
                    $tables[] = [
                        'name' => $tableName,
                        'row_count' => $dbService->getTableRowCount($tableName),
                        'is_pinned' => in_array($tableName, $project->pinned_tables ?? []),
                    ];
                }
            }

            $dbService->disconnect();
        }

        return Inertia::render('tables/index', [
            'tables' => $tables,
            'hasDatabase' => $hasDatabase,
            'pinnedTables' => $project->pinned_tables ?? [],
        ]);
    }

    public function show(Request $request, string $table): Response
    {
        $project = Project::find($request->session()->get('current_project_id'));

        $data = [];
        $columns = [];
        $foreignKeys = [];
        $hasDatabase = false;
        $tableExists = false;

        if ($project && $project->hasDatabase()) {
            $hasDatabase = true;
            $dbService = new ProjectDatabaseService($project);

            $result = $dbService->testConnection();
            if ($result['connected']) {
                // Validate table name against actual tables to prevent SQL injection
                $availableTables = $dbService->getTables()->toArray();
                if (in_array($table, $availableTables, true)) {
                    $tableExists = true;
                    $columns = $dbService->getTableColumns($table)->toArray();
                    $data = $dbService->getTableData($table, 15);
                    $foreignKeys = $dbService->getTableForeignKeys($table);
                }
            }

            $dbService->disconnect();
        }

        if ($hasDatabase && ! $tableExists) {
            abort(404, 'Table not found');
        }

        return Inertia::render('tables/show', [
            'table' => $table,
            'data' => $data,
            'columns' => $columns,
            'foreignKeys' => $foreignKeys,
            'hasDatabase' => $hasDatabase,
            'isPinned' => in_array($table, $project->pinned_tables ?? []),
        ]);
    }

    public function record(Request $request, string $table, string $id): Response
    {
        $project = Project::find($request->session()->get('current_project_id'));

        $record = null;
        $columns = [];
        $foreignKeys = [];
        $hasDatabase = false;
        $tableExists = false;
        $primaryKey = 'id';

        if ($project && $project->hasDatabase()) {
            $hasDatabase = true;
            $dbService = new ProjectDatabaseService($project);

            $result = $dbService->testConnection();
            if ($result['connected']) {
                // Validate table name against actual tables to prevent SQL injection
                $availableTables = $dbService->getTables()->toArray();
                if (in_array($table, $availableTables, true)) {
                    $tableExists = true;
                    $primaryKey = $dbService->getPrimaryKey($table) ?? 'id';
                    $columns = $dbService->getTableColumns($table)->toArray();
                    $foreignKeys = $dbService->getTableForeignKeys($table);
                    $record = $dbService->getTableRow($table, $primaryKey, $id);
                }
            }

            $dbService->disconnect();
        }

        if ($hasDatabase && (! $tableExists || ! $record)) {
            abort(404, 'Record not found');
        }

        return Inertia::render('tables/record', [
            'table' => $table,
            'record' => $record,
            'recordId' => $id,
            'columns' => $columns,
            'foreignKeys' => $foreignKeys,
            'primaryKey' => $primaryKey,
            'hasDatabase' => $hasDatabase,
        ]);
    }

    public function pin(Request $request, string $table): JsonResponse
    {
        $project = Project::find($request->session()->get('current_project_id'));

        if (! $project) {
            return response()->json(['success' => false, 'message' => 'No project selected'], 400);
        }

        // Validate table exists to prevent storing malicious table names
        if ($project->hasDatabase()) {
            $dbService = new ProjectDatabaseService($project);
            $result = $dbService->testConnection();
            if ($result['connected']) {
                $availableTables = $dbService->getTables()->toArray();
                if (! in_array($table, $availableTables, true)) {
                    $dbService->disconnect();

                    return response()->json(['success' => false, 'message' => 'Table not found'], 404);
                }
            }
            $dbService->disconnect();
        }

        $pinnedTables = $project->pinned_tables ?? [];

        if (! in_array($table, $pinnedTables)) {
            $pinnedTables[] = $table;
            $project->update(['pinned_tables' => $pinnedTables]);
        }

        return response()->json(['success' => true, 'pinned_tables' => $pinnedTables]);
    }

    public function unpin(Request $request, string $table): JsonResponse
    {
        $project = Project::find($request->session()->get('current_project_id'));

        if (! $project) {
            return response()->json(['success' => false, 'message' => 'No project selected'], 400);
        }

        $pinnedTables = $project->pinned_tables ?? [];
        $pinnedTables = array_values(array_filter($pinnedTables, fn ($t) => $t !== $table));

        $project->update(['pinned_tables' => $pinnedTables]);

        return response()->json(['success' => true, 'pinned_tables' => $pinnedTables]);
    }
}
