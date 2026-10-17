<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Session-based sign-in through Laravel Sanctum's SPA authentication.
 * The browser gets an httpOnly session cookie (JavaScript can't read it) plus a CSRF token.
 * Flow: GET /sanctum/csrf-cookie → POST /api/login → use the API → POST /api/logout.
 */
class AuthController extends Controller
{
    public function login(LoginRequest $request): UserResource
    {
        $request->authenticate();
        // New session id after sign-in prevents session fixation attacks.
        $request->session()->regenerate();

        $user = $request->user();
        $user->forceFill(['last_active_at' => now()])->save();
        Audit::log('Signed in', $user, $user->name, "Signed in as {$user->role->label()}");

        return new UserResource($user);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    /** Rules for every new password: at least 8 characters, with letters and numbers. */
    public static function passwordRules(): array
    {
        return ['required', 'string', 'confirmed', PasswordRule::min(8)->letters()->numbers()];
    }

    /**
     * POST /api/forgot-password { email }
     * Emails a reset link (valid 60 minutes, one use) to active accounts. Always answers the
     * same way, so nobody can use this to find out which emails have accounts.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', strtolower($data['email']))->where('status', UserStatus::Active->value)->first();
        if ($user) {
            // Laravel also limits this to one email per minute per account.
            Password::broker()->sendResetLink(['email' => $user->email]);
        }

        return response()->json(['message' => 'If that email has an account, a reset link is on its way.']);
    }

    /**
     * POST /api/reset-password { token, email, password, password_confirmation }
     * Sets a new password from an emailed link. The link works once, for 60 minutes.
     * Afterwards the account is signed out everywhere.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => self::passwordRules(),
        ]);

        $status = Password::broker()->reset(
            ['email' => strtolower($data['email']), 'token' => $data['token'], 'password' => $data['password']],
            function (User $user, string $password) {
                abort_unless($user->status === UserStatus::Active, 422, 'This account isn’t active yet. Use your invite link instead.');
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                DB::table('sessions')->where('user_id', $user->id)->delete();
                event(new PasswordReset($user));
                Audit::log('Updated', $user, $user->name, 'Password reset from an emailed link');
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => 'This reset link is invalid or has expired. Ask for a new one.',
            ]);
        }

        return response()->json(['message' => 'Your password has been changed. Sign in with your new password.']);
    }

    /**
     * PUT /api/me/password { current_password, password, password_confirmation }
     * Changes your own password and signs you out on your other devices.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => self::passwordRules(),
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'That isn’t your current password.']);
        }

        $user->forceFill(['password' => $data['password']])->save();
        // Sign out everywhere else (keep this browser's session).
        DB::table('sessions')->where('user_id', $user->id)
            ->when($request->hasSession(), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
            ->delete();
        Audit::log('Updated', $user, $user->name, 'Changed their password');

        return response()->json(['message' => 'Password changed.']);
    }
}
