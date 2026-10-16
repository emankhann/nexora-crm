<?php

namespace App\Enums;

enum DealStage: string
{
    case New = 'new';
    case Contacted = 'contacted';
    case Qualified = 'qualified';
    case Proposal = 'proposal';
    case Won = 'won';
    case Lost = 'lost';

    /** Default chance of closing at each stage, used for the weighted forecast. */
    public function probability(): int
    {
        return match ($this) {
            self::New => 10,
            self::Contacted => 25,
            self::Qualified => 50,
            self::Proposal => 65,
            self::Won => 100,
            self::Lost => 0,
        };
    }

    public function isOpen(): bool
    {
        return ! in_array($this, [self::Won, self::Lost], true);
    }

    /** @return list<self> */
    public static function open(): array
    {
        return [self::New, self::Contacted, self::Qualified, self::Proposal];
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
