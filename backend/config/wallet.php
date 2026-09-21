<?php

return [
    // Economic writes must not silently fall back to a mutable balance column.
    // Set false only for a deliberate, temporary migration shadow period.
    'require_ledger' => (bool) env('WALLET_REQUIRE_LEDGER', true),
];
