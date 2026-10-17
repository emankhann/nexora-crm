<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\TeamInvite;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Team and roles (admins only): invite people, change roles, manage pending invites.
 */
class TeamController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('manage-team');

        return UserResource::collection(User::orderBy('id')->get());
    }

    public function invite(Request $request): JsonResponse
    {
        Gate::authorize('manage-team');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
            'role' => ['required', Rule::enum(Role::class)],
        ], ['email.unique' => 'This person is already on the team.']);

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            // Random password: they set their own from the invite link.
            'password' => Str::random(40),
            'role' => $data['role'],
            'status' => UserStatus::Pending,
            'invited_at' => now(),
        ]);
        Audit::log('Created', $user, $user->email, "Invited as {$user->role->label()}");
        $this->sendInvite($user, $request->user());

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function updateRole(Request $request, User $user): UserResource
    {
        Gate::authorize('manage-team');
        $data = $request->validate(['role' => ['required', Rule::enum(Role::class)]]);
        $role = Role::from($data['role']);

        abort_if($user->is($request->user()), 422, 'You can’t change your own role.');
        abort_if(
            $user->role === Role::Admin && $role !== Role::Admin
                && User::where('role', Role::Admin->value)->where('status', UserStatus::Active->value)->count() <= 1,
            422,
            'Nexora needs at least one admin. Make someone else an admin first.'
        );

        $from = $user->role;
        if ($from !== $role) {
            $user->update(['role' => $role]);
            Audit::log('Role changed', $user, $user->name, "{$from->label()} to {$role->label()}");
        }

        return new UserResource($user);
    }

    public function resendInvite(User $user): UserResource
    {
        Gate::authorize('manage-team');
        abort_unless($user->status === UserStatus::Pending, 422, 'This person has already joined.');

        $user->update(['invited_at' => now()]);
        // A new link replaces the old one, so an earlier email stops working.
        $this->sendInvite($user, request()->user());
        Audit::log('Updated', $user, $user->email, 'Invite sent again');

        return new UserResource($user);
    }

    public function revokeInvite(User $user): Response
    {
        Gate::authorize('manage-team');
        abort_unless($user->status === UserStatus::Pending, 422, 'Only pending invites can be cancelled.');

        Audit::log('Deleted', $user, $user->email, 'Invite cancelled');
        Password::broker('invites')->deleteToken($user);
        $user->delete();

        return response()->noContent();
    }

    /** Emails a join link with a fresh one-time token (valid 7 days). */
    private function sendInvite(User $user, User $invitedBy): void
    {
        $token = Password::broker('invites')->createToken($user);
        $user->notify(new TeamInvite($token, $invitedBy->name));
    }
}
