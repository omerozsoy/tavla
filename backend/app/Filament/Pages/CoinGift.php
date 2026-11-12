<?php

namespace App\Filament\Pages;

use App\Models\User;
use App\Services\WalletService;
use App\Support\OfficialMessenger;
use App\Support\Shield;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Coin Hediye Et — admin panelden bir kitleye toplu coin dağıtır. Her hediye WalletService
 * ledger'ına "admin_gift" tipiyle, hediyeyi yapan admin actor_user_id olarak yazılır
 * (sonradan "kim dağıttı" izlenebilir). Kitleler:
 *   all      -> tüm gerçek kullanıcılar
 *   online   -> çevrimiçi (last_seen son 2 dk; PlayerMessage/AuthController ile birebir kriter)
 *   matches  -> en az N maç yapanlar (match_results satır sayısı)
 *   balance  -> bakiyesi N coin'in ALTINDA olanlar
 *
 * ponytail: senkron chunk'lı dağıtım (WalletService kullanıcı başına kilitli tx). Çok büyük
 * kitlede (tüm kullanıcılar) yavaş olabilir; gerekirse queue job'a taşınır. İki-kez-gönderime
 * karşı her gönderim tek batch token üretir -> idempotency key ile çift-kredit engellenir.
 */
class CoinGift extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-gift';

    protected static ?string $navigationLabel = 'Coin Hediye Et';

    protected static ?string $title = 'Coin Hediye Et';

    protected static ?string $navigationGroup = 'Mağaza';

    protected static ?int $navigationSort = 5;

    protected static string $view = 'filament.pages.coin-gift';

    public ?array $data = [];

    /** Hediye mesajı yer tutucusu: admin metne bunu yazar, coin miktarıyla değiştirilir. */
    public const COIN_TOKEN = '*coin*';

    public const DEFAULT_MESSAGE = self::COIN_TOKEN.' coin yönetim tarafından hesabınıza hediye edilmiştir. İyi oyunlar! 🎁';

    public function mount(): void
    {
        $this->form->fill([
            'target' => 'all',
            'amount' => null,
            'min_matches' => 10,
            'max_balance' => 100,
            'notify' => true,
            'notify_message' => self::DEFAULT_MESSAGE,
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Hediye')
                    ->schema([
                        TextInput::make('amount')->label('Coin miktarı')
                            ->numeric()->required()->minValue(1)->maxValue(1_000_000)
                            ->helperText('Her uygun kullanıcıya eklenecek coin.'),
                        Radio::make('target')->label('Kime verilsin?')
                            ->options([
                                'all' => 'Tüm kullanıcılar',
                                'online' => 'Çevrimiçi oyuncular (son 2 dk)',
                                'matches' => 'Belirli sayının üstünde maç yapanlar',
                                'balance' => 'Belirli bakiyenin altındaki kullanıcılar',
                            ])
                            ->default('all')->live()->required(),
                        TextInput::make('min_matches')->label('En az maç sayısı')
                            ->numeric()->minValue(1)
                            ->visible(fn (callable $get) => $get('target') === 'matches')
                            ->required(fn (callable $get) => $get('target') === 'matches')
                            ->helperText('Bu kadar VE ÜSTÜ maç yapmış kullanıcılar.'),
                        TextInput::make('max_balance')->label('Bakiye üst sınırı (coin)')
                            ->numeric()->minValue(0)
                            ->visible(fn (callable $get) => $get('target') === 'balance')
                            ->required(fn (callable $get) => $get('target') === 'balance')
                            ->helperText('Bakiyesi bu değerin ALTINDA olan kullanıcılar.'),
                        Toggle::make('notify')->label('Hediye mesajı gönder')
                            ->live()
                            ->helperText('Tavla TV Yönetim hesabından DM + site-içi bildirim atılır.'),
                        Textarea::make('notify_message')->label('Mesaj metni')
                            ->rows(3)->maxLength(500)
                            ->visible(fn (callable $get) => (bool) $get('notify'))
                            ->helperText('Mesajı serbestçe yaz. Coin miktarının geleceği yere '.self::COIN_TOKEN
                                .' yaz — otomatik olarak sayıyla değiştirilir (ör. '.self::COIN_TOKEN.' → 1.500). Boş bırakırsan varsayılan metin gönderilir.'),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    /** Seçilen kitleyi veren sorgu (sistem hesapları hariç). */
    protected function audience(array $data)
    {
        $target = $data['target'] ?? 'all';

        return User::query()
            ->when(Schema::hasColumn('users', 'is_system'), fn ($q) => $q->where('is_system', false))
            ->when($target === 'online', fn ($q) => $q
                ->where('last_seen', '>=', now()->subMinutes(2))
                ->where(fn ($w) => $w->whereNull('presence_status')
                    ->orWhereNotIn('presence_status', ['offline', 'ghost'])))
            ->when($target === 'matches', fn ($q) => $q->whereRaw(
                '(select count(*) from match_results where match_results.user_id = users.id) >= ?',
                [(int) ($data['min_matches'] ?? 0)]))
            ->when($target === 'balance', fn ($q) => $q
                ->where('coins', '<', (int) ($data['max_balance'] ?? 0)));
    }

    /** Dağıtmadan önce kaç kişiye gideceğini göster. */
    public function preview(): void
    {
        $data = $this->form->getState();
        $n = $this->audience($data)->count();
        Notification::make()->title("Bu ayarlarla {$n} kullanıcı hediye alacak.")->info()->send();
    }

    public function gift(): void
    {
        $data = $this->form->getState();
        $amount = (int) ($data['amount'] ?? 0);
        if ($amount < 1) {
            Notification::make()->title('Coin miktarı en az 1 olmalı.')->danger()->send();

            return;
        }

        $wallet = app(WalletService::class);
        $adminId = auth()->id();
        // Tek gönderim = tek batch token. Livewire çift-submit'inde aynı key -> çift-kredit olmaz.
        $batch = (string) Str::uuid();
        $count = 0;
        $recipientIds = [];

        $this->audience($data)
            ->select(['id', 'coins', 'coins_reserved'])
            ->chunkById(500, function ($users) use ($wallet, $amount, $adminId, $batch, &$count, &$recipientIds) {
                foreach ($users as $u) {
                    $wallet->credit($u, $amount, 'admin_gift', null, null, "gift:{$batch}:{$u->id}", $adminId);
                    $recipientIds[] = (int) $u->id;
                    $count++;
                }
            });

        Shield::audit($adminId, 'filament_coin_gift',
            sprintf('target=%s amount=%d recipients=%d batch=%s', $data['target'] ?? 'all', $amount, $count, $batch), 3);

        // Hediye bildirimi: Tavla TV Yönetim hesabından DM + site-içi bildirim (toast).
        // Admin metni serbest yazar; *coin* yer tutucusu miktarla değiştirilir (boşsa varsayılan).
        if (! empty($data['notify']) && $recipientIds) {
            $template = trim((string) ($data['notify_message'] ?? ''));
            if ($template === '') {
                $template = self::DEFAULT_MESSAGE;
            }
            $body = str_replace(self::COIN_TOKEN, number_format($amount, 0, ',', '.'), $template);
            OfficialMessenger::sendToIds($recipientIds, $body);
        }

        Notification::make()->title("{$amount} coin, {$count} kullanıcıya hediye edildi.")->success()->send();
    }
}
