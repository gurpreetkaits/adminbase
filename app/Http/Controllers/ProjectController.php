<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use App\Services\ProjectDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('projects/create');
    }

    public function store(StoreProjectRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // Test connection if database details provided
        if (! empty($data['db_host']) && ! empty($data['db_database'])) {
            $tempProject = new Project($data);
            $dbService = new ProjectDatabaseService($tempProject);

            $result = $dbService->testConnection();
            $data['is_connected'] = $result['connected'];
            $dbService->disconnect();
        }

        $project = Project::create($data);

        $request->session()->put('current_project_id', $project->id);

        return redirect()->route('dashboard')->with('success', 'Project created successfully.');
    }

    public function switch(Request $request, Project $project): RedirectResponse
    {
        $request->session()->put('current_project_id', $project->id);

        return redirect()->back();
    }

    public function destroy(Request $request, Project $project): RedirectResponse
    {
        $currentProjectId = $request->session()->get('current_project_id');

        $project->delete();

        // If deleted project was the current one, switch to another project
        if ($currentProjectId === $project->id) {
            $nextProject = Project::first();
            $request->session()->put('current_project_id', $nextProject?->id);
        }

        return redirect()->route('tables.index')->with('success', 'Project deleted successfully.');
    }

    public function testConnection(Request $request): JsonResponse
    {
        $request->validate([
            'db_driver' => ['nullable', 'string', 'in:mysql,mariadb'],
            'db_host' => ['required', 'string'],
            'db_port' => ['required', 'integer'],
            'db_database' => ['required', 'string'],
            'db_username' => ['required', 'string'],
            'db_password' => ['nullable', 'string'],
        ]);

        $tempProject = new Project($request->all());
        $dbService = new ProjectDatabaseService($tempProject);

        $result = $dbService->testConnection();
        $tables = $result['connected'] ? $dbService->getTables() : collect();
        $dbService->disconnect();

        return response()->json([
            'connected' => $result['connected'],
            'error' => $result['error'],
            'tables' => $tables,
        ]);
    }
}
