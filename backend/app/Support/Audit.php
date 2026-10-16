<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * One line to record "who did what to which record" in the audit log.
 *
 *   Audit::log('Reassigned', $lead, $lead->name, 'Owner changed to Omar T.');
 */
class Audit
{
    public static function log(string $action, ?Model $record, string $label, ?string $details = null): AuditLog
    {
        return AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'record_type' => $record ? class_basename($record) : null,
            'record_id' => $record?->getKey(),
            'record_label' => mb_substr($label, 0, 255),
            'details' => $details ? mb_substr($details, 0, 255) : null,
            'ip_address' => Request::ip(),
        ]);
    }
}
