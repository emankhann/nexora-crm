<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

/**
 * Joining the team from an emailed invite (see TeamController::invite and the TeamInvite email).
 * The link holds a one-time token from the "invites" password broker (config/auth.php), valid 7 days.
 */
class InviteController extends Controller
{
    /** POST /api/invites/check { token, email } → who the invite is for, so the page can greet them. */
    public function check(Request $request): JsonResponse
    {
        $user = $this->invitedUser($request);

        return response()->json(['name' => $user->name, 'email' => $user->email, 'role' => $user->role->label()]);
    }

    /**
     * POST /api/invites/accept { token, email, password, password_confirmation }
     * Sets their password, activates the account and signs them in.
     */
    public function accept(Request $request): UserResource
    {
        $request->validate(['password' => AuthController::passwordRules()]);
        $user = $this->invitedUser($request);

        $user->forceFill([
            'password' => $request->string('password')->toString(),
            'status' => UserStatus::Active,
            'email_verified_at' => now(),
            'last_active_at' => now(),
        ])->save();
        Password::broker('invites')->deleteToken($user);
        Audit::log('Updated', $user, $user->name, "Accepted the invite and joined as {$user->role->label()}");

        // Sign them in (this replaces whoever was signed in in this browser).
        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return new UserResource($user);
    }

    private function invitedUser(Request $request): User
    {
        $data = $request->validate(['token' => ['required', 'string'], 'email' => ['required', 'email']]);
        $user = User::where('email', strtolower($data['email']))->where('status', UserStatus::Pending->value)->first();

        if (! $user || ! Password::broker('invites')->tokenExists($user, $data['token'])) {
            throw ValidationException::withMessages([
                'token' => 'This invite link is invalid or has expired. Ask your admin to send a new one.',
            ]);
        }

        return $user;
    }
}
