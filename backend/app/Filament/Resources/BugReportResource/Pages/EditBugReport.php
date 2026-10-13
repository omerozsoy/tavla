<?php

namespace App\Filament\Resources\BugReportResource\Pages;

use App\Filament\Resources\BugReportResource;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EditBugReport extends EditRecord
{
    protected static string $resource = BugReportResource::class;

    // Hata ödülü kademeleri (istemci "Hata Bildir" hero'suyla aynı): büyük 10.000 / küçük 5.000.
    private const REWARD_BIG = 10000;

    private const REWARD_SMALL = 5000;

    // Bu rapora ZATEN ödül tanımlanmış mı? (wallet ledger'da bug_report referansı var mı).
    private function alreadyRewarded(): bool
    {
        return WalletTransaction::query()
            ->where('type', 'bug_report_reward')
            ->where('reference_type', 'bug_report')
            ->where('reference_id', $this->record->id)
            ->exists();
    }

    protected function getHeaderActions(): array
    {
        return [
            // Ödül tanımla: iyi bir hata bildiren ÜYE'ye coin hediye et. Kademe seçilir
            // (büyük 10.000 / küçük 5.000 / özel). WalletService idempotency + ledger yazar;
            // reference=bug_report:<id> -> rapor başına TEK ödül (yanlışlıkla çift tıklama korur).
            Actions\Action::make('reward')
                ->label(fn () => $this->alreadyRewarded() ? 'Ödül Tanımlandı' : 'Ödül Tanımla')
                ->icon('heroicon-o-gift')
                ->color('warning')
                ->disabled(fn () => ! $this->record->user_id || $this->alreadyRewarded())
                ->tooltip(fn () => ! $this->record->user_id
                    ? 'Bildiren üye değil (misafir) — coin tanımlanamaz.'
                    : ($this->alreadyRewarded() ? 'Bu bildirime zaten ödül tanımlandı.' : null))
                ->modalHeading('Hata Ödülü Tanımla')
                ->modalDescription('Seçtiğiniz coin ödülü bildiren üyenin cüzdanına eklenir ve kayda geçer. Her bildirime yalnızca bir kez ödül tanımlanabilir.')
                ->modalSubmitActionLabel('Coin Ekle')
                ->form([
                    Forms\Components\Placeholder::make('reward_recipient')->label('Alıcı üye')
                        ->content(fn () => ($this->record->name ?: ('#'.$this->record->user_id))),
                    Forms\Components\Select::make('tier')->label('Ödül')
                        ->options([
                            'big' => 'Büyük hata — '.number_format(self::REWARD_BIG, 0, ',', '.').' coin',
                            'small' => 'Küçük hata — '.number_format(self::REWARD_SMALL, 0, ',', '.').' coin',
                        ])
                        ->default('small')->required()->native(false),
                    // Opsiyonel özel tutar: DOLUYSA kademeyi EZER. Her zaman görünür (live/visibility
                    // bağımlılığı yok -> modal submit'te state sıfırlanmaz, seçilen kademe garanti gider).
                    Forms\Components\TextInput::make('custom_amount')->label('Özel tutar (coin) — opsiyonel')
                        ->helperText('Boş bırakın: yukarıdaki kademe uygulanır. Girerseniz bu tutar verilir.')
                        ->numeric()->minValue(1)->maxValue(1000000),
                    Forms\Components\Toggle::make('mark_resolved')
                        ->label('Bu bildirimi “Çözüldü” olarak işaretle')->default(true),
                ])
                ->action(function (array $data) {
                    if ($this->alreadyRewarded()) {
                        Notification::make()->title('Bu bildirime zaten ödül tanımlanmış.')->warning()->send();

                        return;
                    }
                    $user = User::find($this->record->user_id);
                    if (! $user) {
                        Notification::make()->title('Bildiren üye bulunamadı (hesap silinmiş olabilir).')->danger()->send();

                        return;
                    }
                    // Özel tutar DOLUYSA kademeyi ezer; boşsa seçilen kademe (büyük 10.000 / küçük 5.000).
                    $amount = filled($data['custom_amount'] ?? null)
                        ? (int) $data['custom_amount']
                        : (($data['tier'] ?? 'small') === 'big' ? self::REWARD_BIG : self::REWARD_SMALL);
                    if ($amount < 1) {
                        Notification::make()->title('Geçerli bir tutar girin.')->danger()->send();

                        return;
                    }

                    app(WalletService::class)->credit(
                        $user, $amount, 'bug_report_reward', 'bug_report', $this->record->id, null, auth()->id(),
                    );

                    $this->record->update([
                        'status' => ($data['mark_resolved'] ?? false) ? 'resolved' : $this->record->status,
                        'admin_note' => trim(($this->record->admin_note ? $this->record->admin_note."\n" : '')
                            .'[Ödül] '.number_format($amount, 0, ',', '.').' coin tanımlandı ('.now()->tz('Europe/Istanbul')->format('d.m.Y H:i').').'),
                    ]);
                    $this->refreshFormData(['status', 'admin_note']);

                    // Üyeye in-app bildirim + push: hata ödülü hesabına eklendi (best-effort).
                    \App\Models\Notification::notify(
                        $user->id,
                        'Hata ödülün hesabına eklendi 🎉',
                        number_format($amount, 0, ',', '.').' coin hediye edildi. Bildirimin için teşekkürler!',
                        'gift',
                    );

                    Notification::make()
                        ->title('Ödül tanımlandı')
                        ->body(($this->record->name ?: ('#'.$user->id)).' üyesine '.number_format($amount, 0, ',', '.').' coin eklendi.')
                        ->success()->send();
                }),

            // Bildirene yanıt: metni panelde kaydeder (admin_reply + replied_at) VE bildirenin
            // e-postasına teşekkür + yanıt maili atar. E-posta yoksa buton pasif.
            Actions\Action::make('reply')
                ->label('Yanıtla ve E-posta Gönder')
                ->icon('heroicon-o-paper-airplane')
                ->color('primary')
                ->disabled(fn () => blank($this->record->email))
                ->tooltip(fn () => blank($this->record->email)
                    ? 'Bildiren e-posta bırakmadığı için yanıt gönderilemez.'
                    : null)
                ->modalHeading('Bildirene Yanıt Gönder')
                ->modalDescription('Yazdığınız yanıt panelde kaydedilir ve bildirenin e-postasına bir teşekkür mesajıyla birlikte gönderilir.')
                ->modalSubmitActionLabel('Kaydet ve Gönder')
                ->form([
                    Forms\Components\Placeholder::make('recipient')->label('Alıcı')
                        ->content(fn () => ($this->record->name ?: 'Misafir').' <'.$this->record->email.'>'),
                    Forms\Components\Textarea::make('admin_reply')->label('Yanıtınız')
                        ->default(fn () => $this->record->admin_reply)
                        ->placeholder('Bildirimin için teşekkürler! Sorunu inceledik ve …')
                        ->rows(6)->required()->maxLength(5000)->autosize(),
                    // Yanıta GÖRSEL (opsiyonel): ekran görüntüsü/çizim; e-postaya hem gömülür hem eklenir.
                    Forms\Components\FileUpload::make('reply_image')->label('Görsel ekle (opsiyonel)')
                        ->image()->disk('uploads')->directory('bug-replies')->imageEditor()
                        ->maxSize(8192)
                        ->default(fn () => $this->record->admin_reply_image)
                        ->helperText('Bildirene gönderilen e-postaya eklenir.'),
                    Forms\Components\Toggle::make('mark_resolved')
                        ->label('Bu bildirimi “Çözüldü” olarak işaretle')
                        ->default(true),
                ])
                ->action(function (array $data) {
                    // FileUpload tek dosya -> yol string (ya da dizi ilk eleman). Normalize et.
                    $img = $data['reply_image'] ?? null;
                    if (is_array($img)) {
                        $img = $img[0] ?? null;
                    }
                    // Önce kaydet (mail patlasa da yanıt panelde durur).
                    $this->record->update([
                        'admin_reply' => $data['admin_reply'],
                        'admin_reply_image' => $img,
                        'replied_at' => now(),
                        'status' => ($data['mark_resolved'] ?? false) ? 'resolved' : $this->record->status,
                    ]);

                    // Görselin tam dosya yolu (ek) + herkese açık URL (gömülü <img>).
                    $imgFsPath = $img && \Illuminate\Support\Facades\Storage::disk('uploads')->exists($img)
                        ? \Illuminate\Support\Facades\Storage::disk('uploads')->path($img) : null;
                    $imgUrl = $img ? rtrim(config('app.url'), '/').'/uploads/'.$img : null;

                    // Teşekkür + yanıt e-postası (best-effort).
                    $sent = false;
                    try {
                        Mail::send('emails.bug-reply', [
                            'greetingName' => $this->record->name,
                            'replyText' => $data['admin_reply'],
                            'originalMessage' => $this->record->message,
                            'replyImageUrl' => $imgUrl,
                        ], function ($m) use ($imgFsPath) {
                            $m->to($this->record->email, $this->record->name ?: $this->record->email)
                                ->subject('TavlaTV — Bildirimine Yanıt (#'.$this->record->id.')');
                            if ($imgFsPath) {
                                $m->attach($imgFsPath);
                            }
                        });
                        $sent = true;
                    } catch (\Throwable $e) {
                        Log::warning('Hata bildirimi yaniti gonderilemedi: '.$e->getMessage(), [
                            'report_id' => $this->record->id,
                        ]);
                    }

                    // Açık formu tazele (durum + yanıt anında yansısın).
                    $this->refreshFormData(['status', 'admin_reply', 'replied_at']);

                    Notification::make()
                        ->title($sent ? 'Yanıt gönderildi' : 'Yanıt kaydedildi (e-posta gönderilemedi)')
                        ->body($sent
                            ? $this->record->email.' adresine teşekkür + yanıt e-postası gönderildi.'
                            : 'Yanıt panelde kaydedildi ancak e-posta gönderilemedi. Mail ayarlarını kontrol edin.')
                        ->{$sent ? 'success' : 'warning'}()
                        ->send();
                }),

            Actions\DeleteAction::make()->label('Sil'),
        ];
    }
}
