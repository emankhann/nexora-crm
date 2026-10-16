<?php

use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DealController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TeamController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Nexora CRM API  (all routes are prefixed with /api)
|--------------------------------------------------------------------------
| Authentication: Laravel Sanctum SPA (session cookie + CSRF token).
| Authorization: app/Policies (per record) and Gates in AppServiceProvider (per role).
*/

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');

Route::middleware(['auth:sanctum', 'throttle:240,1'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Everything the user may see, in one request (used by the frontend on load).
    Route::get('/crm', BootstrapController::class);
    Route::get('/reports', ReportController::class);

    // Leads
    Route::post('/leads/bulk', [LeadController::class, 'bulk']);
    Route::post('/leads/import', [LeadController::class, 'import']);
    Route::post('/leads/{lead}/convert', [LeadController::class, 'convert']);
    Route::apiResource('leads', LeadController::class);

    // Customers
    Route::post('/customers/{customer}/contacts', [CustomerController::class, 'addContact']);
    Route::apiResource('customers', CustomerController::class);

    // Deals / pipeline
    Route::post('/deals/{deal}/move', [DealController::class, 'move']);
    Route::apiResource('deals', DealController::class);

    // Tasks and follow-ups
    Route::post('/tasks/{task}/toggle', [TaskController::class, 'toggle']);
    Route::post('/tasks/{task}/follow-ups', [TaskController::class, 'followUp']);
    Route::apiResource('tasks', TaskController::class);

    // Communication history
    Route::post('/activities', [ActivityController::class, 'store']);

    // Reminders in the bell
    Route::post('/notifications/read', [NotificationController::class, 'markRead']);

    // Admin only (checked inside the controllers with Gates)
    Route::get('/audit-log', [AuditLogController::class, 'index']);
    Route::get('/team', [TeamController::class, 'index']);
    Route::post('/team/invite', [TeamController::class, 'invite']);
    Route::patch('/team/{user}/role', [TeamController::class, 'updateRole']);
    Route::post('/team/{user}/resend', [TeamController::class, 'resendInvite']);
    Route::delete('/team/{user}', [TeamController::class, 'revokeInvite']);
});
