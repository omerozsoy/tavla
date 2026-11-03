<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TeamResource\Pages;
use App\Models\Team;
use App\Models\TeamAudit;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\TeamLeague\TeamException;
use App\Support\TeamLeague\TeamService;
use Filament\Forms\Form;
use Filament\Infolists;
use Filament\Infolists\Infolist;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Takımlar Ligi — ADMIN (§12): takım arama/inceleme, logo onay/ret, gerekçeli kapatma. Takım kimliğini
 * admin DÜZENLEMEZ (kullanıcı yönetir) → create/edit kapalı; yalnız moderasyon aksiyonları. Panel zaten
 * EnsureAdmin; aksiyonlar TeamService (transaction + audit) üzerinden. Bağımsız navigasyon grubu.
 */
class TeamResource extends Resource
{
    protected static ?string $model = Team::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationGroup = 'Takımlar Ligi';

    protected static ?string $navigationLabel = 'Takımlar';

    protected static ?string $modelLabel = 'takım';

    protected static ?string $pluralModelLabel = 'Takımlar';

    public static function canCreate(): bool
    {
        return false; // takımlar kullanıcı tarafından kurulur
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // düzenleme yok
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('tag')->label('Etiket')->badge()->searchable(),
                Tables\Columns\TextColumn::make('name')->label('Ad')->searchable()->limit(30),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->color(fn (string $state) => $state === 'active' ? 'success' : 'gray'),
                Tables\Columns\TextColumn::make('member_count')->label('Üye')->sortable(),
                Tables\Columns\TextColumn::make('rating_avg')->label('Ortalama')->numeric(1)->sortable(),
                Tables\Columns\IconColumn::make('logo_pending')->label('Logo onayı')
                    ->boolean()->trueIcon('heroicon-o-clock')->falseIcon('heroicon-o-minus')
                    ->tooltip(fn (Team $r) => $r->logo_pending ? 'Onay bekleyen logo var' : null),
                Tables\Columns\TextColumn::make('founder_id')->label('Kurucu')
                    ->formatStateUsing(fn ($state) => User::whereKey($state)->value('nickname') ?? ('#'.$state)),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')
                    ->options(['active' => 'Aktif', 'closed' => 'Kapalı']),
                Tables\Filters\Filter::make('logo_pending')->label('Logo onayı bekleyen')
                    ->query(fn ($q) => $q->whereNotNull('logo_pending')),
            ])
            ->actions([
                Tables\Actions\ViewAction::make()->label('İncele'),
                Tables\Actions\Action::make('approveLogo')->label('Logo Onayla')
                    ->icon('heroicon-o-check')->color('success')
                    ->visible(fn (Team $r) => ! empty($r->logo_pending))
                    ->requiresConfirmation()
                    ->action(fn (Team $r) => self::run(fn () => app(TeamService::class)->approveLogo($r, (int) auth()->id()), 'Logo onaylandı.')),
                Tables\Actions\Action::make('rejectLogo')->label('Logo Reddet')
                    ->icon('heroicon-o-x-mark')->color('danger')
                    ->visible(fn (Team $r) => ! empty($r->logo_pending))
                    ->requiresConfirmation()
                    ->action(fn (Team $r) => self::run(fn () => app(TeamService::class)->rejectLogo($r, (int) auth()->id()), 'Logo reddedildi.')),
                Tables\Actions\Action::make('close')->label('Takımı Kapat')
                    ->icon('heroicon-o-lock-closed')->color('danger')
                    ->visible(fn (Team $r) => $r->status === 'active')
                    ->requiresConfirmation()
                    ->modalDescription('Üyelikler sonlanır, 72 saat bekleme başlar. Tarihsel maçlar/ödüller korunur. Sonuçlanmamış karşılaşma varsa önce çözülmeli.')
                    ->action(fn (Team $r) => self::run(fn () => app(TeamService::class)->adminClose($r, (int) auth()->id()), 'Takım kapatıldı.')),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            Infolists\Components\Section::make('Takım')->schema([
                Infolists\Components\TextEntry::make('tag')->label('Etiket')->badge(),
                Infolists\Components\TextEntry::make('name')->label('Ad'),
                Infolists\Components\TextEntry::make('status')->label('Durum')->badge(),
                Infolists\Components\TextEntry::make('member_count')->label('Üye sayısı'),
                Infolists\Components\TextEntry::make('rating_avg')->label('Rating ortalaması')->numeric(1),
                Infolists\Components\ColorEntry::make('color1')->label('Renk 1'),
                Infolists\Components\ColorEntry::make('color2')->label('Renk 2'),
                Infolists\Components\ImageEntry::make('logo')->label('Logo')->disk('uploads')->visible(fn (Team $r) => (bool) $r->logo),
                Infolists\Components\TextEntry::make('description')->label('Açıklama')->placeholder('—')->columnSpanFull(),
            ])->columns(3),
            Infolists\Components\Section::make('Üyeler')->schema([
                Infolists\Components\TextEntry::make('members_list')->hiddenLabel()->columnSpanFull()
                    ->state(fn (Team $r) => self::membersText($r)),
            ]),
            Infolists\Components\Section::make('İşlem geçmişi (son 25)')->schema([
                Infolists\Components\TextEntry::make('audit_list')->hiddenLabel()->columnSpanFull()
                    ->state(fn (Team $r) => self::auditsText($r)),
            ])->collapsed(),
        ]);
    }

    private static function membersText(Team $r): string
    {
        $members = TeamMember::where('team_id', $r->id)->get();
        $names = User::whereIn('id', $members->pluck('user_id'))->pluck('nickname', 'id');
        $roleLabel = ['founder' => 'Kurucu', 'assistant' => 'Yardımcı', 'member' => 'Üye'];

        return $members->sortBy(fn ($m) => array_search($m->role, ['founder', 'assistant', 'member']))
            ->map(fn ($m) => ($roleLabel[$m->role] ?? $m->role).': '.($names[$m->user_id] ?? ('#'.$m->user_id)))
            ->implode("\n") ?: '—';
    }

    private static function auditsText(Team $r): string
    {
        return TeamAudit::where('team_id', $r->id)->orderByDesc('id')->limit(25)->get()
            ->map(fn (TeamAudit $a) => ($a->created_at?->format('d.m.Y H:i') ?? '').' — '.$a->action
                .($a->target_user_id ? ' (hedef #'.$a->target_user_id.')' : ''))
            ->implode("\n") ?: '—';
    }

    /** Aksiyon sarmalı: TeamException/kural ihlallerini Filament bildirimine çevir. */
    private static function run(callable $fn, string $success): void
    {
        try {
            $fn();
            Notification::make()->title($success)->success()->send();
        } catch (TeamException $e) {
            Notification::make()->title('İşlem başarısız')->body($e->errorCode)->danger()->send();
        } catch (\Throwable $e) {
            Notification::make()->title('Hata')->body($e->getMessage())->danger()->send();
        }
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTeams::route('/'),
        ];
    }
}
