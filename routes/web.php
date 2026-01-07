<?php

use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectUserController;
use App\Http\Controllers\TableController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('projects/create', [ProjectController::class, 'create'])->name('projects.create');
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::post('projects/test-connection', [ProjectController::class, 'testConnection'])->name('projects.test-connection');
    Route::post('projects/{project}/switch', [ProjectController::class, 'switch'])->name('projects.switch');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');
    Route::get('users', [ProjectUserController::class, 'index'])->name('users.index');
    Route::get('feedbacks', [FeedbackController::class, 'index'])->name('feedbacks.index');

    Route::get('tables', [TableController::class, 'index'])->name('tables.index');
    Route::get('tables/{table}', [TableController::class, 'show'])->name('tables.show');
    Route::get('tables/{table}/data', [TableController::class, 'data'])->name('tables.data');
    Route::get('tables/{table}/record/{id}', [TableController::class, 'record'])->name('tables.record');
    Route::put('tables/{table}/update', [TableController::class, 'update'])->name('tables.update');
    Route::post('tables/{table}/pin', [TableController::class, 'pin'])->name('tables.pin');
    Route::post('tables/{table}/unpin', [TableController::class, 'unpin'])->name('tables.unpin');
});

require __DIR__.'/settings.php';
