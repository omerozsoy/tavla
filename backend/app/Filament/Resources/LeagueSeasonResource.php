<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LeagueSeasonResource\Pages;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Support\League\LeagueRuntime;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\DB;

/**
 * Türkiye Online Tavla Ligi — ADMIN paneli (§13/§17). Bağımsız navigasyon grubu (turnuvadan ayrı).
 * Tüm yönetim işlemleri yalnız admin (panel zaten EnsureAdmin; ayrıca LeagueController API'de is_admin).
 * Helper (is_support) buraya erişemez. Kritik işlemler LeagueRuntime'da transaction + Shield::audit.
 */
class LeagueSeasonResource extends Resource
{
    protected static ?string $model = LeagueSeason::class;

    protected static ?string $navigationIcon = 'heroicon-o-trophy';

    protected static ?string $navigationGroup = 'Türkiye Online Tavla Ligi';

    protected static ?string $navigationLabel = 'Sezonlar';

    protected static ?string $modelLabel = 'lig sezonu';

    protected static ?string $pluralModelLabel = 'Lig Sezonları';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->label('Sezon adı')->default('Türkiye Online Tavla Ligi')->maxLength(120)->required(),
            Forms\Components\TextInput::make('league_match_length')->label('Lig maç uzunluğu (sayı)')->numeric()->default(9)->minValue(1)->maxValue(25)->required(),
            Forms\Components\TextInput::make('knockout_match_length')->label('Eleme maç uzunluğu (sayı)')->numeric()->default(9)->minValue(1)->maxValue(25)->required(),
            Forms\Components\DateTimePicker::make('applications_open_at')->label('Başvuru açılış')->seconds(false),
            Forms\Components\DateTimePicker::make('applications_close_at')->label('Başvuru kapanış')->seconds(false),
            Forms\Components\Repeater::make('prizes')->label('Ödüller (§15)')
                ->schema([
                    Forms\Components\Select::make('key')->label('Derece/grup')->options([
                        'champion' => 'Şampiyon',
                        'runner_up' => 'Finalist (2.)',
                        'semifinalist' => 'Yarı finalist',
                        'quarterfinalist' => 'Çeyrek finalist',
                        'last16' => 'Son 16',
                    ])->required(),
                    Forms\Components\TextInput::make('coins')->label('Coin')->numeric()->default(0),
                    Forms\Components\TextInput::make('badge')->label('Rozet anahtarı')->maxLength(40),
                    Forms\Components\TextInput::make('desc')->label('Açıklama')->maxLength(120),
                ])->columns(4)->default([])->reorderable(false),
            Forms\Components\KeyValue::make('tiebreak_manual')->label('Admin eşitlik sırası (userId => sıra; düşük=üst) §5')
                ->keyLabel('Kullanıcı ID')->valueLabel('Sıra')->default([]),
            Forms\Components\Placeholder::make('status_info')->label('Durum')
                ->content(fn (?LeagueSeason $record) => $record ? $record->status.' — tur '.$record->current_round.'/'.$record->rounds_total : 'yeni (taslak)'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('ID')->sortable(),
                Tables\Columns\TextColumn::make('name')->label('Ad')->searchable(),
                Tables\Columns\BadgeColumn::make('status')->label('Durum')
                    ->color(fn (string $state): string => match ($state) {
                        'draft' => 'gray',
                        'applications' => 'warning',
                        'selection' => 'info',
                        'league' => 'primary',
                        'knockout' => 'success',
                        'finished' => 'gray',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('current_round')->label('Tur')
                    ->formatStateUsing(fn ($state, LeagueSeason $r) => $state.'/'.$r->rounds_total),
                Tables\Columns\TextColumn::make('accepted_count')->label('Seçili')
                    ->getStateUsing(fn (LeagueSeason $r) => $r->participants()->where('status', 'accepted')->count()),
                Tables\Columns\TextColumn::make('pending_count')->label('Başvuru')
                    ->getStateUsing(fn (LeagueSeason $r) => $r->participants()->where('status', 'pending')->count()),
                Tables\Columns\TextColumn::make('created_at')->label('Oluşturma')->dateTime('d.m.Y H:i'),
            ])
            ->actions([
                self::openApplicationsAction(),
                self::decideAction(),
                self::startAction(),
                self::drawAction(),
                self::confirmLeagueAction(),
                self::buildKnockoutAction(),
                self::withdrawAction(),
                Tables\Actions\EditAction::make(),
            ])
            ->defaultSort('id', 'desc');
    }

    // ---- Yaşam döngüsü aksiyonları (hepsi try/catch -> Filament bildirimi) ----

    private static function openApplicationsAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('openApplications')->label('Başvuruları Aç')
            ->icon('heroicon-o-lock-open')->color('warning')
            ->visible(fn (LeagueSeason $r) => $r->status === 'draft')
            ->form([
                Forms\Components\DateTimePicker::make('open_at')->label('Açılış')->default(now())->seconds(false),
                Forms\Components\DateTimePicker::make('close_at')->label('Kapanış')->seconds(false),
            ])
            ->action(fn (LeagueSeason $r, array $data) => self::run(fn () => LeagueRuntime::openApplications($r, $data['open_at'] ?? null, $data['close_at'] ?? null), 'Başvurular açıldı.'));
    }

    private static function decideAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('decide')->label('Oyuncu Seç')
            ->icon('heroicon-o-user-group')->color('info')
            ->visible(fn (LeagueSeason $r) => in_array($r->status, ['applications', 'selection'], true))
            ->form(fn (LeagueSeason $r) => [
                Forms\Components\CheckboxList::make('accepted')->label('Asıl oyuncular (33-48)')
                    ->options(self::applicantOptions($r))->columns(2)->searchable()
                    ->default(fn () => $r->participants()->where('status', 'accepted')->pluck('user_id')->all()),
                Forms\Components\CheckboxList::make('reserve')->label('Yedekler')
                    ->options(self::applicantOptions($r))->columns(2)->searchable()
                    ->default(fn () => $r->participants()->where('status', 'reserve')->pluck('user_id')->all()),
            ])
            ->action(function (LeagueSeason $r, array $data) {
                $map = [];
                foreach ($data['accepted'] ?? [] as $uid) {
                    $map[(int) $uid] = 'accepted';
                }
                foreach ($data['reserve'] ?? [] as $uid) {
                    if (! isset($map[(int) $uid])) {
                        $map[(int) $uid] = 'reserve';
                    }
                }
                self::run(fn () => LeagueRuntime::decide($r, $map, auth()->id()), 'Seçim kaydedildi.');
            });
    }

    private static function startAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('start')->label('Ligi Başlat')
            ->icon('heroicon-o-play')->color('success')->requiresConfirmation()
            ->modalDescription('33-48 seçili oyuncuyla lig başlar; kura sırası kilitlenir. Yeni oyuncu/yedek alınamaz.')
            ->visible(fn (LeagueSeason $r) => in_array($r->status, ['applications', 'selection'], true))
            ->action(fn (LeagueSeason $r) => self::run(fn () => LeagueRuntime::startLeague($r), 'Lig başladı.'));
    }

    private static function drawAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('draw')->label('Kura Çek')
            ->icon('heroicon-o-sparkles')->color('success')
            ->visible(fn (LeagueSeason $r) => $r->status === 'league' && LeagueRuntime::canDraw($r)['can'])
            ->form([
                Forms\Components\DateTimePicker::make('mandatory_at')->label('Zorunlu maç saati (§8)')->seconds(false)->required(),
                Forms\Components\DateTimePicker::make('deadline_at')->label('Son oynanma tarihi')->seconds(false)->required(),
            ])
            ->action(fn (LeagueSeason $r, array $data) => self::run(fn () => LeagueRuntime::drawRound($r, $data['mandatory_at'], $data['deadline_at']), 'Tur kurası çekildi.'));
    }

    private static function confirmLeagueAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('confirmLeague')->label('Lig Aşamasını Kesinleştir')
            ->icon('heroicon-o-check-badge')->color('primary')->requiresConfirmation()
            ->modalDescription('Nihai sıralama + o anki rating dondurulur, ön eleme oluşturulur. Kritik eşitlikler çözülmemişse engellenir (§5).')
            ->visible(fn (LeagueSeason $r) => $r->status === 'league' && $r->current_round >= $r->rounds_total)
            ->action(fn (LeagueSeason $r) => self::run(fn () => LeagueRuntime::confirmLeaguePhase($r), 'Lig aşaması kesinleşti, ön eleme kuruldu.'));
    }

    private static function buildKnockoutAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('buildKnockout')->label('Son 16’yı Kur')
            ->icon('heroicon-o-trophy')->color('success')->requiresConfirmation()
            ->visible(fn (LeagueSeason $r) => $r->status === 'knockout')
            ->action(fn (LeagueSeason $r) => self::run(fn () => LeagueRuntime::buildKnockout($r), 'Son 16 ve ağaç kuruldu.'));
    }

    private static function withdrawAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('withdraw')->label('Oyuncu Çek (§10)')
            ->icon('heroicon-o-arrow-right-start-on-rectangle')->color('danger')
            ->visible(fn (LeagueSeason $r) => in_array($r->status, ['league', 'knockout'], true))
            ->form(fn (LeagueSeason $r) => [
                Forms\Components\Select::make('user_id')->label('Çekilecek oyuncu')
                    ->options(fn () => self::activePlayerOptions($r))->searchable()->required(),
            ])
            ->action(fn (LeagueSeason $r, array $data) => self::run(fn () => LeagueRuntime::withdraw($r, (int) $data['user_id'], auth()->id()), 'Oyuncu çekildi.'));
    }

    /** Başvuranlar + seçilmişler (checkbox seçenekleri): userId => "nickname (rating)". */
    private static function applicantOptions(LeagueSeason $r): array
    {
        $ids = $r->participants()->whereIn('status', ['pending', 'accepted', 'reserve'])->pluck('user_id');

        return self::labelMap($ids->all());
    }

    private static function activePlayerOptions(LeagueSeason $r): array
    {
        $ids = $r->participants()->where('status', 'accepted')->pluck('user_id');

        return self::labelMap($ids->all());
    }

    private static function labelMap(array $ids): array
    {
        return User::whereIn('id', $ids)->get(['id', 'nickname', 'rating'])
            ->mapWithKeys(fn ($u) => [$u->id => $u->nickname.' ('.(int) $u->rating.')'])->all();
    }

    /** Runtime çağrısını çalıştır; kural ihlali (RuntimeException) -> Filament uyarı bildirimi. */
    private static function run(callable $fn, string $success): void
    {
        try {
            DB::transaction($fn);
            Notification::make()->title($success)->success()->send();
        } catch (\RuntimeException $e) {
            Notification::make()->title('İşlem yapılamadı')->body($e->getMessage())->warning()->send();
        } catch (\Throwable $e) {
            Notification::make()->title('Hata')->body($e->getMessage())->danger()->send();
        }
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLeagueSeasons::route('/'),
            'create' => Pages\CreateLeagueSeason::route('/create'),
            'edit' => Pages\EditLeagueSeason::route('/{record}/edit'),
        ];
    }
}
