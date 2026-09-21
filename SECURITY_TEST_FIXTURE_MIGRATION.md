# Security Test Fixture Migration Plan

Production authorization and server-authoritative checks must remain strict. Existing Feature tests need to model the current contract.

## Room identity

Every room fixture that has `p1_user_id` or `p2_user_id` must create those `User` rows and call `Sanctum::actingAs()` for the seat issuing the request. Numeric IDs without rows are no longer a valid authenticated fixture. Guest fixtures must leave the seat user ID null and use a unique capability token.

## Authoritative commands

Every `roll`, `move`, cube, and `resign` request in an authoritative room must include:

```php
[
    'command_id' => (string) Str::uuid(),
    'expected_version' => (int) $room->fresh()->server_version,
]
```

Retries reuse the original `command_id`; they may refresh only `expected_version`. Tests should assert a replay response and unchanged state.

## State and dice

Authoritative fixtures must seed `server_state`, `server_match`, and server-issued dice through the roll endpoint. Client `state`, score, winner, cube, and dice payloads are not setup shortcuts for authoritative tests. Legacy `update()` fixtures belong only to `friendly + non-authoritative + zero-stake` tests.

## Economic flows

Settlement fixtures must use verified `server_match` results and real users. Wallet assertions should include the corresponding `wallet_transactions` rows. Checkout tests should send a stable UUID `idempotency_key` and assert the second request does not create an order or change stock/balance.

## Expected status changes

The following are intentional after hardening:

- missing/omitted command envelope: `428`;
- stale state version: `409`;
- room seat/account mismatch: `403`;
- unverified client result/rating input: `409`;
- validator unavailable in required mode: `503`.

## Batch order

1. `RoomServerAuthTest`, `AuthoritativeLoopTest`, `RoomCubeTest`, `RoomDiceAuthorityTest`.
2. `ServerMoveTest`, `ServerMatchTest`, `BotRoomTest`.
3. `RoomSettleTest`, `RoomEscrowTest`, `ForfeitLossTest`.
4. `GameLogTest`, `AchievementTest`, `LuckV1EndToEndTest`.
5. Playwright authoritative and duplicate-submit scenarios.

Do not weaken a production guard to make a legacy fixture pass.
