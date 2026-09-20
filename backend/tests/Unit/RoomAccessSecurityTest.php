<?php

namespace Tests\Unit;

use App\Http\Middleware\EnsureActiveAccount;
use App\Models\Room;
use App\Models\User;
use App\Support\RoomAccess;
use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory as ResponseFactoryContract;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\Request;
use Illuminate\Routing\Redirector;
use Illuminate\Routing\ResponseFactory;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Facade;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Response;

/** No application boot, database, migrations or network. */
class RoomAccessSecurityTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        parent::tearDown();
    }

    private function user(int $id, bool $banned = false): User
    {
        $user = new User();
        $user->setDateFormat('Y-m-d H:i:s');
        $user->setRawAttributes(['id' => $id, 'banned_at' => $banned ? '2026-01-01 00:00:00' : null]);

        return $user;
    }

    public static function seats(): array
    {
        return [
            'anonymous stolen token' => [[], null, 'white-token', null],
            'other account stolen token' => [[], 33, 'white-token', null],
            'owner new device' => [[], 11, 'new-device', 'p1'],
            'owner without guest token' => [[], 11, '', 'p1'],
            'opponent token does not select opponent' => [[], 22, 'white-token', 'p2'],
            'duplicate owner fails closed' => [['p2_user_id' => 11], 11, 'white-token', null],
            'free guest retained' => [['p1_user_id' => null], null, 'white-token', 'p1'],
            'guest wrong token' => [['p1_user_id' => null], null, 'wrong', null],
            'ranked guest forbidden' => [['p1_user_id' => null, 'mode' => 'ranked'], null, 'white-token', null],
            'fixed stake guest forbidden' => [['p1_user_id' => null, 'stake' => 100], null, 'white-token', null],
            'percent stake guest forbidden' => [['p1_user_id' => null, 'bet_pct' => 5], null, 'white-token', null],
            'reserved room guest forbidden' => [['p1_user_id' => null, 'escrowed' => true], null, 'white-token', null],
            'multi stake guest forbidden' => [['p1_user_id' => null, 'stakes' => [0, 100]], null, 'white-token', null],
            'ambiguous guest capability' => [['p1_user_id' => null, 'p2_user_id' => null, 'p2_token' => 'white-token'], null, 'white-token', null],
            'bot seat forbidden' => [['p2_user_id' => null, 'bot' => true], null, 'black-token', null],
            'bot account seat forbidden' => [['bot' => true], 22, 'black-token', null],
        ];
    }

    #[DataProvider('seats')]
    public function test_seat_identity(array $overrides, ?int $id, string $token, ?string $expected): void
    {
        $room = new Room(array_replace([
            'p1_user_id' => 11, 'p2_user_id' => 22,
            'p1_token' => 'white-token', 'p2_token' => 'black-token',
            'mode' => 'friendly', 'stake' => 0, 'bet_pct' => 0,
        ], $overrides));
        self::assertSame($expected, RoomAccess::slot($room, $id === null ? null : $this->user($id), $token));
    }

    public function test_banned_owner_is_denied(): void
    {
        self::assertNull(RoomAccess::slot(new Room(['p1_user_id' => 11]), $this->user(11, true)));
    }

    public static function credentials(): array
    {
        return [
            'anonymous guest' => [null, false, false, 204],
            'invalid or revoked bearer' => [null, true, false, 401],
            'active account' => [11, true, false, 204],
            'banned bearer' => [11, true, true, 403],
            'banned session' => [11, false, true, 403],
        ];
    }

    #[DataProvider('credentials')]
    public function test_middleware_uses_sanctum_identity(?int $id, bool $bearer, bool $banned, int $status): void
    {
        $container = new Container();
        Container::setInstance($container);
        $container->instance(ResponseFactoryContract::class, new ResponseFactory(
            Mockery::mock(ViewFactory::class), Mockery::mock(Redirector::class),
        ));
        $request = Request::create('/api/rooms/SAFE1/roll', 'POST');
        if ($bearer) {
            $request->headers->set('Authorization', 'Bearer synthetic-token');
        }
        $request->setUserResolver(function ($guard) use ($id, $banned) {
            self::assertSame('sanctum', $guard);

            return $id === null ? null : $this->user($id, $banned);
        });
        $called = false;
        $response = (new EnsureActiveAccount())->handle($request, function () use (&$called) {
            $called = true;

            return new Response('', 204);
        });
        self::assertSame($status, $response->getStatusCode());
        self::assertSame($status === 204, $called);
    }

    public function test_real_routes_cover_commands_and_keep_authenticated_logout_available(): void
    {
        $container = new Container();
        Container::setInstance($container);
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($container);
        $router = new Router(new Dispatcher($container), $container);
        $container->instance('router', $router);
        require __DIR__.'/../../routes/api.php';

        foreach (['roll', 'move', 'cube/offer', 'cube/respond', 'resign', 'join', 'enter', 'settle', 'rematch', 'leave', 'chat', 'live', 'watch', 'bot'] as $action) {
            $route = $router->getRoutes()->match(Request::create('/rooms/SAFE1/'.$action, 'POST'));
            self::assertContains(EnsureActiveAccount::class, $route->gatherMiddleware(), $action);
        }
        foreach (['/matchmaking', '/matchmaking/cancel'] as $path) {
            $route = $router->getRoutes()->match(Request::create($path, 'POST'));
            self::assertContains('auth:sanctum', $route->gatherMiddleware());
            self::assertContains(EnsureActiveAccount::class, $route->gatherMiddleware());
        }
        $logout = $router->getRoutes()->match(Request::create('/logout', 'POST'));
        self::assertContains('auth:sanctum', $logout->gatherMiddleware());
        self::assertContains(EnsureActiveAccount::class, $logout->excludedMiddleware());
    }
}
