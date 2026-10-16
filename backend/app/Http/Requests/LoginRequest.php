<?php

namespace App\Http\Requests;

use App\Enums\UserStatus;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Validates the sign-in form and blocks brute force:
 * 5 wrong attempts per email + IP locks sign-in for that pair for a while.
 */
class LoginRequest extends FormRequest
{
    private const MAX_ATTEMPTS = 5;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = [
            'email' => Str::lower((string) $this->string('email')),
            'password' => (string) $this->string('password'),
            // Pending invites can't sign in until they've set a password.
            'status' => UserStatus::Active->value,
        ];

        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey(), 15 * 60);
            $left = RateLimiter::remaining($this->throttleKey(), self::MAX_ATTEMPTS);

            throw ValidationException::withMessages([
                'email' => $left > 0
                    ? "Email or password is incorrect. {$left} more ".($left === 1 ? 'try' : 'tries').' before a 15-minute lock.'
                    : 'Too many attempts. Try again in 15 minutes.',
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    private function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), self::MAX_ATTEMPTS)) {
            return;
        }

        event(new Lockout($this));
        $minutes = (int) ceil(RateLimiter::availableIn($this->throttleKey()) / 60);

        throw ValidationException::withMessages([
            'email' => "Too many attempts. Try again in {$minutes} minute".($minutes === 1 ? '' : 's').'.',
        ]);
    }

    private function throttleKey(): string
    {
        return Str::transliterate(Str::lower((string) $this->string('email')).'|'.$this->ip());
    }
}
