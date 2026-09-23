<?php

namespace App\Filament\Pages;

use App\Models\User;
use App\Support\OfficialMessenger;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Schema;

/**
 * Oyunculara Mesaj — admin panelden tek bir oyuncuya VEYA tüm kullanıcılara "Tavla TV
 * Yönetim" kimliğiyle DM gönderir. Görünen ad + avatar kaydedilir (OfficialMessenger =
 * is_system'li resmi hesap). Mesajlar oyuncunun NORMAL gelen kutusunda görünür (istek
 * kutusuna düşmez); oyuncu doğrudan cevap yazabilir.
 */
class PlayerMessage extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-paper-airplane';

    protected static ?string $navigationLabel = 'Oyunculara Mesaj';

    protected static ?string $title = 'Oyunculara Mesaj Gönder';

    protected static ?string $navigationGroup = 'İletişim';

    protected static ?int $navigationSort = 0;

    protected static string $view = 'filament.pages.player-message';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'sender_name' => OfficialMessenger::name(),
            'sender_avatar' => OfficialMessenger::avatarPath() ?: null,
            'target' => 'one',
            'user_id' => null,
            'body' => '',
            'image' => null,
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Gönderen kimliği')
                    ->description('Mesajlar oyunculara bu ad ve avatarla ulaşır. Bir kez ayarla; her mesajda tekrar girmene gerek yok. Varsayılan ad "Tavla TV Yönetim".')
                    ->schema([
                        TextInput::make('sender_name')->label('Görünen ad')
                            ->required()->maxLength(40)
                            ->helperText('Oyuncunun gelen kutusunda görünecek isim. Başka bir kullanıcının takma adıyla aynı olamaz.'),
                        FileUpload::make('sender_avatar')->label('Avatar')
                            ->image()->avatar()
                            ->disk('uploads')->directory('system')->visibility('public')
                            ->maxSize(4096)
                            ->helperText('Kare bir görsel önerilir. Boş bırakırsan mevcut avatar korunur.'),
                    ])->columns(2),
                Section::make('Mesaj')
                    ->schema([
                        Radio::make('target')->label('Kime gönderilsin?')
                            ->options(['one' => 'Tek oyuncu', 'all' => 'Tüm kullanıcılar'])
                            ->default('one')->inline()->live()->required(),
                        Select::make('user_id')->label('Oyuncu')
                            ->searchable()
                            ->getSearchResultsUsing(fn (string $search) => static::searchUsers($search))
                            ->getOptionLabelUsing(fn ($value) => optional(User::find($value))->nickname)
                            ->visible(fn (callable $get) => $get('target') === 'one')
                            ->required(fn (callable $get) => $get('target') === 'one')
                            ->helperText('Takma ada, ada veya e-postaya göre ara.'),
                        Textarea::make('body')->label('Mesaj')
                            ->rows(5)->maxLength(4000)
                            ->helperText('En fazla 4000 karakter. Metin veya görselden en az biri gerekli.'),
                        FileUpload::make('image')->label('Görsel (isteğe bağlı)')
                            ->image()
                            ->disk('uploads')->directory('system')->visibility('public')
                            ->maxSize(8192),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    /** Oyuncu arama (sistem hesapları hariç). */
    public static function searchUsers(string $search): array
    {
        $search = trim($search);
        if ($search === '') {
            return [];
        }

        return User::query()
            ->when(Schema::hasColumn('users', 'is_system'), fn ($q) => $q->where('is_system', false))
            ->where(function ($q) use ($search) {
                $q->where('nickname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%");
            })
            ->orderBy('nickname')
            ->limit(30)
            ->pluck('nickname', 'id')
            ->all();
    }

    public function send(): void
    {
        $data = $this->form->getState();

        // 1) Gönderen kimliğini kaydet. Avatar boşsa (dokunulmadıysa) null -> mevcut korunur.
        $name = trim((string) ($data['sender_name'] ?? ''));
        $avatar = $data['sender_avatar'] ?? null;
        $avatarPath = (is_string($avatar) && $avatar !== '') ? $avatar : null;
        if (! OfficialMessenger::updateIdentity($name, $avatarPath)) {
            Notification::make()
                ->title('Bu görünen ad başka bir kullanıcıda kullanılıyor. Lütfen farklı bir ad seç.')
                ->danger()->send();

            return;
        }

        // 2) Mesaj içeriği.
        $body = trim((string) ($data['body'] ?? ''));
        $image = null;
        if (! empty($data['image']) && is_string($data['image'])) {
            $image = '/uploads/'.ltrim($data['image'], '/');
        }
        if ($body === '' && ! $image) {
            Notification::make()->title('Mesaj boş olamaz — metin veya görsel gir.')->danger()->send();

            return;
        }

        // 3) Gönder.
        if (($data['target'] ?? 'one') === 'all') {
            $n = OfficialMessenger::broadcast($body, $image);
            Notification::make()->title("Mesaj {$n} kullanıcıya gönderildi.")->success()->send();
        } else {
            $to = User::find((int) ($data['user_id'] ?? 0));
            if (! $to) {
                Notification::make()->title('Oyuncu bulunamadı.')->danger()->send();

                return;
            }
            OfficialMessenger::sendTo($to, $body, $image);
            Notification::make()->title("Mesaj “{$to->nickname}” kullanıcısına gönderildi.")->success()->send();
        }

        // 4) İçeriği temizle (kimlik korunur).
        $this->form->fill([
            'sender_name' => OfficialMessenger::name(),
            'sender_avatar' => OfficialMessenger::avatarPath() ?: null,
            'target' => $data['target'] ?? 'one',
            'user_id' => null,
            'body' => '',
            'image' => null,
        ]);
    }
}
