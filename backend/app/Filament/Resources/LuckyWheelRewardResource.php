<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LuckyWheelRewardResource\Pages;
use App\Models\LuckyWheelReward;
use App\Models\LuckyWheelSpin;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Şans Çarkı ödül yönetimi. Dilim sayısı BURADA sabit DEĞİLDİR — aktif+tarih+stok
 * uygun ödül sayısı kadar dilim oluşur (min/max ile sınırlı, Ayarlar sayfasından).
 * Kazanma olasılığı weight (ağırlık) ile; gerçek yüzde bilgi amaçlı canlı gösterilir.
 */
class LuckyWheelRewardResource extends Resource
{
    protected static ?string $model = LuckyWheelReward::class;

    protected static ?string $navigationIcon = 'heroicon-o-gift';

    protected static ?string $navigationLabel = 'Şans Çarkı';

    protected static ?string $modelLabel = 'ödül';

    protected static ?string $pluralModelLabel = 'Şans Çarkı Ödülleri';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 5;

    private static function typeOptions(): array
    {
        return [
            'COIN' => 'Coin',
            'PREMIUM_DAY' => 'Premium Gün',
            'AVATAR' => 'Avatar Çerçevesi',
            'BOARD_THEME' => 'Tahta Teması',
            'BADGE' => 'Rozet',
            'FREE_SPIN' => 'Tekrar Çevir (Free Spin)',
            'CUSTOM' => 'Özel (Custom)',
        ];
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Ödül')
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->label('Başlık')->required()->maxLength(60)
                        ->helperText('Dilimde görünecek kısa metin (örn. "250 Coin", "Jackpot").'),
                    Forms\Components\Select::make('type')
                        ->label('Ödül tipi')->options(self::typeOptions())
                        ->default('COIN')->required()->live(),
                    Forms\Components\TextInput::make('amount')
                        ->label(fn (Get $get) => match ($get('type')) {
                            'PREMIUM_DAY' => 'Gün sayısı',
                            'FREE_SPIN' => 'Ekstra çevirme adedi',
                            default => 'Coin miktarı',
                        })
                        ->numeric()->default(0)->minValue(0)
                        ->visible(fn (Get $get) => in_array($get('type'), ['COIN', 'PREMIUM_DAY', 'FREE_SPIN'], true)),
                    Forms\Components\TextInput::make('reference_id')
                        ->label(fn (Get $get) => match ($get('type')) {
                            'AVATAR' => 'Çerçeve motion id (örn. pulse) — boş/"random" = rastgele',
                            'BOARD_THEME' => 'Tahta tema id (örn. gold) — boş/"random" = rastgele',
                            'BADGE' => 'Rozet slug (örn. match_5)',
                            default => 'Referans id',
                        })
                        ->placeholder(fn (Get $get) => in_array($get('type'), ['AVATAR', 'BOARD_THEME'], true) ? 'random' : null)
                        ->maxLength(60)
                        ->visible(fn (Get $get) => in_array($get('type'), ['AVATAR', 'BOARD_THEME', 'BADGE', 'CUSTOM'], true))
                        ->helperText(fn (Get $get) => in_array($get('type'), ['AVATAR', 'BOARD_THEME'], true)
                            ? 'Boş bırak ya da "random" yaz: kullanıcının sahip OLMADIĞI rastgele bir çerçeve/tema hediye edilir. Belirli bir id yazarsan daima onu verir.'
                            : 'Kullanıcıya verilecek kozmetik/rozet kimliği.'),
                    Forms\Components\Textarea::make('description')
                        ->label('Açıklama')->rows(2)->maxLength(255)->columnSpanFull(),
                ])->columns(2),

            Forms\Components\Section::make('Olasılık (ağırlık)')
                ->schema([
                    Forms\Components\TextInput::make('weight')
                        ->label('Ağırlık (weight)')->numeric()->required()
                        ->default(10)->minValue(0)->live(onBlur: true)
                        ->helperText('Kazanma ihtimali ağırlıkla belirlenir; toplam 100 olmak ZORUNDA değil.'),
                    Forms\Components\Placeholder::make('probability_preview')
                        ->label('Gerçek yüzde (canlı)')
                        ->content(function (Get $get, ?LuckyWheelReward $record): string {
                            $w = max(0, (int) $get('weight'));
                            // Diğer aktif ödüllerin toplam ağırlığı + bu ödül.
                            $others = (int) LuckyWheelReward::query()
                                ->where('is_active', true)
                                ->when($record, fn ($q) => $q->where('id', '!=', $record->id))
                                ->sum('weight');
                            $total = $others + $w;
                            if ($total <= 0) {
                                return '—';
                            }
                            return '%'.number_format($w / $total * 100, 2);
                        }),
                ])->columns(2),

            Forms\Components\Section::make('Görünüm')
                ->schema([
                    Forms\Components\TextInput::make('icon')
                        ->label('İkon (Phosphor adı)')->maxLength(60)
                        ->helperText('Boş = tipe göre otomatik. Örn: coins, star, medal, gift.'),
                    Forms\Components\TextInput::make('sort')
                        ->label('Sıra')->numeric()->default(0)
                        ->helperText('Çarktaki dilim sırası (listeden sürükle-bırak ile de değişir).'),
                    Forms\Components\ColorPicker::make('slice_color')->label('Dilim rengi'),
                    Forms\Components\ColorPicker::make('text_color')->label('Yazı rengi'),
                ])->columns(2),

            Forms\Components\Section::make('Limit & Stok')
                ->schema([
                    Forms\Components\TextInput::make('stock')
                        ->label('Toplam stok')->numeric()->minValue(0)
                        ->helperText('Boş = sınırsız. Bittiğinde (0) çarktan otomatik çıkar.'),
                    Forms\Components\TextInput::make('daily_win_limit')
                        ->label('Günlük kazanma limiti (toplam)')->numeric()->minValue(0)
                        ->helperText('Boş = sınırsız. Tüm kullanıcılar için gün içi toplam.'),
                    Forms\Components\TextInput::make('per_user_daily_limit')
                        ->label('Kullanıcı başına günlük')->numeric()->minValue(0)
                        ->helperText('Boş = sınırsız.'),
                    Forms\Components\TextInput::make('per_user_lifetime_limit')
                        ->label('Kullanıcı başına ömür boyu')->numeric()->minValue(0)
                        ->helperText('Boş = sınırsız. Örn. Jackpot: 1.'),
                ])->columns(2),

            Forms\Components\Section::make('Tarih & Durum')
                ->schema([
                    Forms\Components\DateTimePicker::make('starts_at')
                        ->label('Başlangıç tarihi')->helperText('Boş = hemen.'),
                    Forms\Components\DateTimePicker::make('ends_at')
                        ->label('Bitiş tarihi')->helperText('Boş = süresiz.'),
                    Forms\Components\Toggle::make('is_active')->label('Aktif')->default(true),
                ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')       // sürükle-bırak -> dilim sırası
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable()->width('1%'),
                Tables\Columns\ColorColumn::make('slice_color')->label('Renk'),
                Tables\Columns\TextColumn::make('name')->label('Ödül')->searchable()->weight('medium'),
                Tables\Columns\TextColumn::make('type')->label('Tip')->badge()
                    ->formatStateUsing(fn ($state) => self::typeOptions()[$state] ?? $state),
                Tables\Columns\TextColumn::make('amount')->label('Miktar')
                    ->formatStateUsing(fn ($state, LuckyWheelReward $r) => in_array($r->type, ['COIN', 'PREMIUM_DAY', 'FREE_SPIN'], true) ? (int) $state : ($r->reference_id ?: '—')),
                // Weight tablodan DOĞRUDAN düzenlenir (tıkla-yaz-Enter). Düzenle formuna
                // girmeden hızlı ağırlık ayarı; blur/Enter'da anında kaydolur, "Gerçek %"
                // sütunu (totalActiveWeight) sonraki render'da yeniden hesaplanır.
                Tables\Columns\TextInputColumn::make('weight')->label('Weight')->sortable()
                    ->type('number')
                    ->rules(['required', 'numeric', 'min:0'])
                    ->extraInputAttributes(['min' => 0, 'step' => 1, 'style' => 'width:5.5rem'])
                    // Ham toplam: görünür (filtreli) TÜM ödüllerin weight toplamı (aktif+pasif).
                    ->summarize(Tables\Columns\Summarizers\Sum::make()->label('Ham toplam')),
                Tables\Columns\TextColumn::make('probability')->label('Gerçek %')
                    ->state(function (LuckyWheelReward $r): string {
                        if (! $r->is_active) {
                            return '—';
                        }
                        $total = LuckyWheelReward::totalActiveWeight();
                        return $total > 0 ? '%'.number_format((int) $r->weight / $total * 100, 2) : '—';
                    })
                    // Alt toplam: aktif ödüllerin yüzde toplamı (weight-tabanlı -> filtresiz %100).
                    // Filtre varsa görünür aktif ödüllerin toplam payını gösterir (payda = TÜM aktif weight).
                    ->summarize(
                        Tables\Columns\Summarizers\Summarizer::make()
                            ->label('Toplam %')
                            ->using(function (\Illuminate\Database\Query\Builder $query): string {
                                $total = LuckyWheelReward::totalActiveWeight();
                                if ($total <= 0) {
                                    return '—';
                                }
                                $visibleActive = (float) (clone $query)->where('is_active', true)->sum('weight');

                                return '%'.number_format($visibleActive / $total * 100, 2);
                            })
                    ),
                Tables\Columns\TextColumn::make('stock')->label('Stok')
                    ->formatStateUsing(fn ($state) => $state === null ? '∞' : (int) $state)->toggleable(),
                Tables\Columns\TextColumn::make('won_today')->label('Bugün')
                    ->state(fn (LuckyWheelReward $r) => LuckyWheelSpin::where('reward_id', $r->id)
                        ->where('created_at', '>=', now()->startOfDay())->count())
                    ->toggleable(),
                Tables\Columns\TextColumn::make('total_won')->label('Toplam')->sortable()->toggleable(),
                Tables\Columns\ToggleColumn::make('is_active')->label('Aktif'),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('is_active')->label('Aktif'),
                Tables\Filters\SelectFilter::make('type')->label('Tip')->options(self::typeOptions()),
            ])
            ->actions([
                Tables\Actions\ReplicateAction::make()->label('Kopyala')
                    ->excludeAttributes(['total_won'])
                    ->beforeReplicaSaved(function (LuckyWheelReward $replica): void {
                        $replica->name = $replica->name.' (kopya)';
                        $replica->total_won = 0;
                    }),
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ])
            ->emptyStateHeading('Henüz ödül yok')
            ->emptyStateDescription('Çarkın çalışması için en az (min. dilim) kadar aktif ödül ekleyin.');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLuckyWheelRewards::route('/'),
            'create' => Pages\CreateLuckyWheelReward::route('/create'),
            'edit' => Pages\EditLuckyWheelReward::route('/{record}/edit'),
        ];
    }
}
