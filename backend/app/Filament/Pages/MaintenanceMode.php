<?php

namespace App\Filament\Pages;

use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\File;
use Illuminate\Support\HtmlString;

/**
 * Bakım Modu — tek toggle ile siteyi bakıma alıp çıkarır. Teknik olarak public/maintenance.on
 * BAYRAK dosyasını oluşturur/siler; .htaccess bu dosya varken /admin ve /panel HARİÇ tüm
 * istekleri 503 + logolu maintenance.html'e yönlendirir (bkz backend/public/.htaccess).
 * Yönetici paneli (/admin) bakımdayken açık kalır; bu yüzden bu sayfa hep erişilebilir.
 */
class MaintenanceMode extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-wrench-screwdriver';

    protected static ?string $navigationLabel = 'Bakım Modu';

    protected static ?string $title = 'Bakım Modu';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 0;

    protected static string $view = 'filament.pages.site-settings';

    public ?array $data = [];

    /** Bayrak dosyasının tam yolu (public/maintenance.on = .htaccess'in DOCUMENT_ROOT'u). */
    private function flagPath(): string
    {
        return public_path('maintenance.on');
    }

    public function isActive(): bool
    {
        return File::exists($this->flagPath());
    }

    public function mount(): void
    {
        $this->form->fill([
            'enabled' => $this->isActive(),
        ]);
    }

    public function form(Form $form): Form
    {
        $active = $this->isActive();
        $status = $active
            ? '<span style="color:#b91c1c;font-weight:600">● AÇIK — site şu an bakımda</span>'
            : '<span style="color:#15803d;font-weight:600">● KAPALI — site normal çalışıyor</span>';

        return $form
            ->schema([
                Section::make('Bakım Modu')
                    ->description('Açıkken ziyaretçiler logolu "bakımdayız" sayfasını görür. Yönetim paneli (/admin) ve /panel açık kalır — bakımdayken buradan çalışmaya devam edebilirsin. Değişiklik anında etkilidir (deploy gerekmez).')
                    ->schema([
                        Placeholder::make('status')->label('Durum')
                            ->content(new HtmlString($status)),
                        Toggle::make('enabled')->label('Bakım modu açık')
                            ->helperText('Aç → site bakım sayfasına geçer. Kapat → normale döner. "Kaydet"e basınca uygulanır.')
                            ->onColor('danger'),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        $want = ! empty($data['enabled']);
        $path = $this->flagPath();

        try {
            if ($want) {
                File::put($path, "maintenance on\n");
            } elseif (File::exists($path)) {
                File::delete($path);
            }
        } catch (\Throwable $e) {
            Notification::make()->title('Uygulanamadı')
                ->body('Bayrak dosyası yazılamadı: '.$e->getMessage().' — sunucuda public/ yazma izni gerekebilir.')
                ->danger()->persistent()->send();

            return;
        }

        Notification::make()
            ->title($want ? 'Site bakım moduna alındı' : 'Site normale döndürüldü')
            ->body($want ? 'Ziyaretçiler artık bakım sayfasını görüyor.' : 'Site tekrar erişilebilir.')
            ->success()->send();
    }
}
