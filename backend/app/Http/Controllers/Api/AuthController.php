<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

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

    /**
     * Forgot password: always answers the same way so nobody can use it
     * to find out which emails have accounts. Sending the email is the next step
     * (Laravel's Password::sendResetLink once a mail driver is configured).
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        return response()->json(['message' => 'If that email has an account, a reset link is on its way.']);
    }
}
