<?php

namespace Tests\Unit;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\TournamentController;
use App\Models\Room;
use App\Models\Tournament;
use App\Models\User;
use App\Services\FairDiceService;
use App\Services\MoveValidatorService;
use App\Support\RoomResult;
use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory as ResponseFactoryContract;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionResolverInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Routing\Redirector;
use Illuminate\Routing\ResponseFactory;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Real controllers/models, mocked persistence. No Laravel boot, PDO, migration or network. */
class SecurityPhaseZeroTest extends TestCase
{
    private Container $container;

    protected function setUp(): void
    {
        parent::setUp();
        $this->container = new Container();
        Container::setInstance($this->container);
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($this->container);
        $this->container->instance('config', new Repository([
            'services' => ['admin_emails' => ['synthetic-admin@example.test']],
        ]));
        $this->container->instance(ResponseFactoryContract::class, new ResponseFactory(
            Mockery::mock(ViewFactory::class), Mockery::mock(Redirector::class),
        ));
        $validator = new Factory(new Translator(new ArrayLoader(), 'en'), $this->container);
        Request::macro('validate', function (array $rules) use ($validator) {
            return $validator->make($this->all(), $rules)->validate();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Model::unsetConnectionResolver();
        Request::flushMacros();
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        parent::tearDown();
    }

    private function room(array $attributes = []): Room
    {
        return new Room(array_replace([
            'code' => 'SAFE0', 'p1_token' => 'white-token', 'p2_token' => 'black-token',
            'p1_user_id' => 11, 'p2_user_id' => 22, 'p1_name' => 'A', 'p2_name' => 'B',
            'authoritative' => true, 'status' => 'playing', 'mode' => 'ranked',
            'stake' => 100, 'bet_pct' => 0,
            'server_match' => ['done' => false, 'winner' => null, 'target' => 3,
                'score' => ['white' => 0, 'black' => 0]],
        ], $attributes));
    }

    private function request(array $payload): Request
    {
        $request = Request::create('/', 'POST', $payload);
        $user = new User();
        $user->setRawAttributes(['id' => 11, 'rating' => 1500]);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    /** Any unexpected SELECT, write, PDO access or external effect fails the test. */
    private function reads(array $models, bool $transaction = false): void
    {
        $connection = Mockery::mock(Connection::class)->makePartial();
        $connection->__construct(null);
        foreach ($models as $model) {
            $table = $model->getTable();
            $connection->shouldReceive('select')->once()->ordered()
                ->withArgs(fn ($sql) => str_contains($sql, '"'.$table.'"'))
                ->andReturn([(object) $model->getAttributes()]);
        }
        $connection->shouldReceive('insert')->never();
        $connection->shouldReceive('update')->never();
        $connection->shouldReceive('delete')->never();
        $connection->shouldReceive('getPdo')->never();
        $resolver = Mockery::mock(ConnectionResolverInterface::class);
        $resolver->shouldReceive('connection')->andReturn($connection);
        Model::setConnectionResolver($resolver);
        if ($transaction) {
            $db = Mockery::mock();
            $db->shouldReceive('transaction')->once()->andReturnUsing(fn ($callback) => $callback());
            $this->container->instance('db', $db);
        }
    }

    public function test_config_email_cannot_grant_admin_even_after_email_change(): void
    {
        $user = new User();
        $user->setRawAttributes(['is_admin' => 0, 'email' => 'other@example.test', 'email_verified_at' => null]);
        $user->email = 'synthetic-admin@example.test';
        self::assertFalse($user->is_admin);
        self::assertFalse($user->isConfigAdmin());
        $user->setRawAttributes(['is_admin' => 1, 'email' => 'explicit@example.test']);
        self::assertTrue($user->is_admin);
    }

    public function test_non_config_admin_cannot_move_into_config_admin_email(): void
    {
        config()->set('services.admin_emails', ['synthetic-admin@example.test']);
        $user = new User();
        $user->setRawAttributes(['is_admin' => 1, 'email' => 'ordinary-admin@example.test']);

        self::assertFalse($user->isConfigAdmin());
        self::assertTrue($user->is_admin);
    }

    public function test_finished_status_alone_never_reveals_seed(): void
    {
        $room = $this->room(['status' => 'finished', 'p1_user_id' => null, 'p2_user_id' => null,
            'dice_seed' => 'synthetic-secret', 'dice_rolls' => [['dice' => [1, 2]]]]);
        self::assertNull($room->toClient()['dice_seed']);
        self::assertNull($room->toClient()['dice_rolls']);
        $room->server_match = ['done' => true, 'winner' => 'white'];
        self::assertSame('synthetic-secret', $room->toClient()['dice_seed']);
        $room->authoritative = false;
        self::assertNull($room->toClient()['dice_seed']);
    }

    public function test_verified_result_requires_terminal_server_state_and_distinct_members(): void
    {
        $room = $this->room(['status' => 'finished']);
        self::assertNull(RoomResult::verified($room, 11));
        $room->server_match = ['done' => true, 'winner' => 'black', 'score' => ['white' => 0, 'black' => 3]];
        self::assertSame(['won' => false, 'self' => 0, 'opp' => 3], RoomResult::verified($room, 11));
        self::assertSame(['won' => true, 'self' => 3, 'opp' => 0], RoomResult::verified($room, 22));
        self::assertNull(RoomResult::verified($room, 33));
        $room->p2_user_id = 11;
        self::assertNull(RoomResult::verified($room, 11));
    }

    public static function protectedRooms(): array
    {
        return [
            'authoritative' => [['authoritative' => true]],
            'fixed stake' => [['stake' => 100]],
            'percent stake' => [['bet_pct' => 10]],
            'ranked' => [['mode' => 'ranked']],
            'bot' => [['bot' => true]],
            'terminal' => [['status' => 'finished']],
            'server state already initialized' => [['server_state' => ['turn' => 'white']]],
        ];
    }

    #[DataProvider('protectedRooms')]
    public function test_legacy_update_cannot_touch_protected_room(array $overrides): void
    {
        $room = $this->room(array_replace([
            'authoritative' => false, 'mode' => 'friendly', 'stake' => 0,
            'server_match' => null, 'server_state' => null,
        ], $overrides));
        $this->reads([$room], true);
        $response = (new RoomController())->update($this->request([
            'token' => 'white-token', 'state' => ['matchOver' => true], 'status' => 'finished',
        ]), 'SAFE0');
        self::assertSame(409, $response->getStatusCode());
    }

    public function test_legacy_friendly_room_fails_closed_without_authoritative_state(): void
    {
        $room = $this->room(['authoritative' => false, 'mode' => 'friendly', 'stake' => 0,
            'server_match' => null, 'server_state' => null]);
        self::assertFalse($room->acceptsLegacyState());
    }

    public static function commands(): array
    {
        return array_map(fn ($method) => [$method], ['roll', 'move', 'cubeOffer', 'cubeRespond', 'resign']);
    }

    #[DataProvider('commands')]
    public function test_terminal_room_rejects_each_game_command_without_writes(string $method): void
    {
        $room = $this->room(['status' => 'finished']);
        // These handlers also read the room in maybeDriveBot before passing through the error.
        $this->reads(in_array($method, ['roll', 'move', 'cubeRespond'], true) ? [$room, $room] : [$room], true);
        $request = $this->request(['token' => 'white-token', 'steps' => [], 'action' => 'take']);
        $controller = new RoomController();
        $response = match ($method) {
            'roll' => $controller->roll($request, 'SAFE0', new FairDiceService()),
            'move' => $controller->move($request, 'SAFE0', Mockery::mock(MoveValidatorService::class)),
            default => $controller->{$method}($request, 'SAFE0'),
        };
        self::assertSame(409, $response->getStatusCode());
    }

    public function test_done_match_cannot_resume_even_with_playing_status(): void
    {
        $room = $this->room(['server_match' => ['done' => true, 'winner' => 'white']]);
        self::assertFalse($room->acceptsGameActions());
    }

    public function test_explicit_stale_authoritative_command_is_rejected(): void
    {
        $room = $this->room(['server_version' => 7]);
        $method = new \ReflectionMethod(RoomController::class, 'staleCommand');
        $method->setAccessible(true);
        $missing = $method->invoke(new RoomController(), $room, []);
        self::assertSame(428, $missing->getStatusCode());
        self::assertSame('expected-version-required', $missing->getData(true)['errors']['reason'] ?? $missing->getData(true)['reason'] ?? null);
        $response = $method->invoke(new RoomController(), $room, ['expected_version' => 6]);
        self::assertSame(409, $response->getStatusCode());
        self::assertSame('stale-version', $response->getData(true)['errors']['reason'] ?? $response->getData(true)['reason'] ?? null);
        self::assertSame(7, $response->getData(true)['errors']['version'] ?? $response->getData(true)['version'] ?? null);
    }

    public static function unauthorizedCommands(): array
    {
        $cases = [];
        foreach (['roll', 'move', 'cubeOffer', 'cubeRespond', 'resign'] as $method) {
            foreach ([null, 33] as $id) {
                $cases[$method.' actor '.($id ?? 'guest')] = [$method, $id];
            }
        }

        return $cases;
    }

    #[DataProvider('unauthorizedCommands')]
    public function test_stolen_room_token_cannot_run_account_game_commands(string $method, ?int $id): void
    {
        $room = $this->room();
        $this->reads(in_array($method, ['roll', 'move', 'cubeRespond'], true) ? [$room, $room] : [$room], true);
        $request = $this->request(['token' => 'white-token', 'steps' => [], 'action' => 'take']);
        $user = new User();
        $user->setRawAttributes(['id' => $id]);
        $request->setUserResolver(fn () => $id === null ? null : $user);
        $controller = new RoomController();
        $response = match ($method) {
            'roll' => $controller->roll($request, 'SAFE0', new FairDiceService()),
            'move' => $controller->move($request, 'SAFE0', Mockery::mock(MoveValidatorService::class)),
            default => $controller->{$method}($request, 'SAFE0'),
        };
        self::assertSame(403, $response->getStatusCode());
    }

    public function test_missing_room_rating_report_is_rejected_before_any_database_access(): void
    {
        $response = (new AuthController())->reportRating($this->request([
            'won' => true, 'opponent_rating' => 4000, 'gammons' => 100,
            'ach_flags' => ['prime6', 'comeback'],
        ]));
        self::assertSame(409, $response->getStatusCode());
        self::assertSame('verified-match-required', $response->getData(true)['reason']);
    }

    public static function invalidResults(): array
    {
        return [
            'unfinished' => [[]],
            'legacy forged result' => [['authoritative' => false, 'status' => 'finished',
                'state' => ['match' => ['score' => ['white' => 99, 'black' => 0]]]]],
            'other participant' => [['p1_user_id' => 33, 'p2_user_id' => 44, 'status' => 'finished',
                'server_match' => ['done' => true, 'winner' => 'white']]],
        ];
    }

    #[DataProvider('invalidResults')]
    public function test_invalid_room_report_never_reaches_rating_or_rewards(array $overrides): void
    {
        $this->reads([$this->room($overrides)]);
        $response = (new AuthController())->reportRating($this->request([
            'won' => true, 'opponent_rating' => 4000, 'room_code' => 'SAFE0',
        ]));
        self::assertSame(409, $response->getStatusCode());
    }

    public function test_tournament_report_without_server_result_cannot_advance_bracket(): void
    {
        $t = new Tournament(['status' => 'running', 'bracket' => [[[
            'key' => 'final', 'p1' => ['id' => 11], 'p2' => ['id' => 22],
        ]]]]);
        $t->id = 1;
        $this->reads([$t], true);
        $response = (new TournamentController())->report($this->request([
            'match' => 'final', 'winner_id' => 11,
        ]), $t);
        self::assertSame(409, $response->getStatusCode());
    }

    public static function tournamentRooms(): array
    {
        return [
            'canonical winner' => [[], 22],
            'reversed seats' => [['p1_user_id' => 22, 'p2_user_id' => 11], 11],
            'unfinished' => [['status' => 'playing'], null],
            'legacy forged score' => [['authoritative' => false,
                'state' => ['match' => ['target' => 3, 'score' => ['white' => 99, 'black' => 0]]]], null],
            'guest impersonates name' => [['p2_user_id' => null, 'p2_name' => 'B'], null],
            'wrong opponent' => [['p1_user_id' => 33], null],
            'duplicate user' => [['p1_user_id' => 22], null],
            'bot' => [['bot' => true], null],
        ];
    }

    #[DataProvider('tournamentRooms')]
    public function test_tournament_resolver_uses_server_winner_and_both_participants(array $overrides, ?int $winner): void
    {
        $room = $this->room(array_replace(['status' => 'finished',
            'server_match' => ['done' => true, 'winner' => 'black']], $overrides));
        $this->reads([$room]);
        $method = new \ReflectionMethod(TournamentController::class, 'winnerIdFromRoom');
        self::assertSame($winner, $method->invoke(new TournamentController(), [
            'room' => 'SAFE0', 'p1' => ['id' => 11, 'name' => 'A'], 'p2' => ['id' => 22, 'name' => 'B'],
        ]));
    }
}
