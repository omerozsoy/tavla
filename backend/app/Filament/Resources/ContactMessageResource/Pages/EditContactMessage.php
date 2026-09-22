<?php

namespace App\Filament\Resources\ContactMessageResource\Pages;

use App\Filament\Resources\ContactMessageResource;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EditContactMessage extends EditRecord
{
    protected static string $resource = ContactMessageResource::class;

    protected function getHeaderActions(): array
    {
        return [
            // Talep sahibine yanıt: metni panelde kaydeder (admin_reply + replied_at) VE
            // talep sahibinin e-postasına yanıt maili atar. E-posta yoksa buton pasif.
            Actions\Action::make('reply')
                ->label('Yanıtla ve E-posta Gönder')
                ->icon('heroicon-o-paper-airplane')
                ->color('primary')
                ->disabled(fn () => blank($this->record->email))
                ->tooltip(fn () => blank($this->record->email)
                    ? 'Talep sahibi e-posta bırakmadığı için yanıt gönderilemez (telefonu deneyin).'
                    : null)
                ->modalHeading('Talep Sahibine Yanıt Gönder')
                ->modalDescription('Yazdığınız yanıt panelde kaydedilir ve talep sahibinin e-postasına gönderilir.')
                ->modalSubmitActionLabel('Kaydet ve Gönder')
                ->form([
                    Forms\Components\Placeholder::make('recipient')->label('Alıcı')
                        ->content(fn () => ($this->record->name ?: 'Talep sahibi').' <'.$this->record->email.'>'),
                    Forms\Components\Textarea::make('admin_reply')->label('Yanıtınız')
                        ->default(fn () => $this->record->admin_reply)
                        ->placeholder('Talebiniz için teşekkürler! Turnuva organizasyonu detayları için …')
                        ->rows(6)->required()->maxLength(5000)->autosize(),
                    Forms\Components\Toggle::make('mark_resolved')
                        ->label('Bu talebi “Çözüldü” olarak işaretle')
                        ->default(true),
                ])
                ->action(function (array $data) {
                    // Önce kaydet (mail patlasa da yanıt panelde durur).
                    $this->record->update([
                        'admin_reply' => $data['admin_reply'],
                        'replied_at' => now(),
                        'status' => ($data['mark_resolved'] ?? false) ? 'resolved' : $this->record->status,
                    ]);

                    // Yanıt e-postası (best-effort, düz metin).
                    $sent = false;
                    try {
                        $greeting = $this->record->name ? ('Merhaba '.$this->record->name.',') : 'Merhaba,';
                        $body = $greeting."\n\n"
                            .$data['admin_reply']."\n\n"
                            ."—\nTavlaTV\nhttps://www.tavlatv.com\n\n"
                            ."Bize ilettiğiniz mesaj:\n".$this->record->message."\n";
                        Mail::raw($body, function ($m) {
                            $m->to($this->record->email, $this->record->name ?: $this->record->email)
                                ->subject('TavlaTV — Talebinize Yanıt (#'.$this->record->id.')');
                        });
                        $sent = true;
                    } catch (\Throwable $e) {
                        Log::warning('İletişim talebi yaniti gonderilemedi: '.$e->getMessage(), [
                            'contact_id' => $this->record->id,
                        ]);
                    }

                    // Açık formu tazele (durum + yanıt anında yansısın).
                    $this->refreshFormData(['status', 'admin_reply', 'replied_at']);

                    Notification::make()
                        ->title($sent ? 'Yanıt gönderildi' : 'Yanıt kaydedildi (e-posta gönderilemedi)')
                        ->body($sent
                            ? $this->record->email.' adresine yanıt e-postası gönderildi.'
                            : 'Yanıt panelde kaydedildi ancak e-posta gönderilemedi. Mail ayarlarını kontrol edin.')
                        ->{$sent ? 'success' : 'warning'}()
                        ->send();
                }),

            Actions\DeleteAction::make()->label('Sil'),
        ];
    }
}
