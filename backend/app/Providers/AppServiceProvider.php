<?php

namespace App\Providers;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    /**
     * Role permissions, matching the table on the Team and roles page:
     *
     *   Permission              Admin  Manager  Sales rep
     *   view all records          ✓       ✓        –   (reps see only their own; see HasOwner::visibleTo)
     *   edit and reassign         ✓       ✓        –
     *   delete records            ✓       –        –
     *   export data               ✓       ✓        –
     *   manage team and roles     ✓       –        –
     *   view audit log            ✓       –        –
     *
     * Record-level rules (e.g. "a rep can edit their own lead") live in app/Policies.
     */
    public function boot(): void
    {
        Gate::define('reassign', fn (User $user) => $user->role->canViewAll());
        Gate::define('delete-records', fn (User $user) => $user->role === Role::Admin);
        Gate::define('export', fn (User $user) => $user->role->canViewAll());
        Gate::define('manage-team', fn (User $user) => $user->role === Role::Admin);
        Gate::define('view-audit-log', fn (User $user) => $user->role === Role::Admin);
    }
}
