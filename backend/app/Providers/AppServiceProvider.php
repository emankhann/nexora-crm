<?php

namespace App\Providers;

use App\Enums\Role;
use App\Models\User;
use App\Support\EmailLink;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
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

        // Password reset emails link to the Next.js page, not to a Laravel route.
        ResetPassword::createUrlUsing(function (User $user, string $token) {
            $url = config('app.frontend_url').'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->email]);
            EmailLink::log($user->email, 'Password reset', $url);

            return $url;
        });

        // Rate limits for the sign-in and account forms (used as throttle:<name> in routes/api.php).
        // Each has its own counter. A plain throttle:5,1 counts every request from the same IP
        // (or signed-in user) on one shared counter, so a few sign-ins would block forgot-password
        // and normal app use would block changing your password.
        $byIp = fn (int $perMinute) => fn (Request $request) => Limit::perMinute($perMinute)->by($request->ip());
        RateLimiter::for('login', $byIp(10));
        RateLimiter::for('forgot-password', $byIp(5));
        RateLimiter::for('reset-password', $byIp(10));
        RateLimiter::for('invite-check', $byIp(20));
        RateLimiter::for('invite-accept', $byIp(10));
        RateLimiter::for('change-password', fn (Request $request) => Limit::perMinute(10)->by((string) ($request->user()?->id ?? $request->ip())));
    }
}
