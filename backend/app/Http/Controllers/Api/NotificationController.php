<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationRead;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * The reminders in the bell are worked out from tasks, deals and assignments.
 * This only remembers which ones the user has already read.
 */
class NotificationController extends Controller
{
    public function markRead(Request $request): Response
    {
        $data = $request->validate([
            'keys' => ['required', 'array', 'max:200'],
            'keys.*' => ['string', 'max:191'],
        ]);
        $userId = $request->user()->id;

        NotificationRead::upsert(
            collect($data['keys'])->unique()->map(fn ($key) => ['user_id' => $userId, 'notice_key' => $key, 'read_at' => now()])->all(),
            ['user_id', 'notice_key'],
            ['read_at']
        );

        return response()->noContent();
    }
}
