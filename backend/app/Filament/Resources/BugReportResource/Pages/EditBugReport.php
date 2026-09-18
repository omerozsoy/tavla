<?php

namespace App\Filament\Resources\BugReportResource\Pages;

use App\Filament\Resources\BugReportResource;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EditBugReport extends EditRecord
{
    protected static string $resource = BugReportResource::class;

    protected function getHeaderActions(): array
    {
        return [
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
                    Forms\Components\Toggle::make('mark_resolved')
                        ->label('Bu bildirimi “Çözüldü” olarak işaretle')
                        ->default(true),
                ])
                ->action(function (array $data) {
                    // Önce kaydet (mail patlasa da yanıt panelde durur).
                    $this->record->update([
                        'admin_reply' => $data['admin_reply'],
                        'replied_at' => now(),
                        'status' => ($data['mark_resolved'] ?? false) ? 'resolved' : $this->record->status,
                    ]);

                    // Teşekkür + yanıt e-postası (best-effort).
                    $sent = false;
                    try {
                        Mail::send('emails.bug-reply', [
                            'greetingName' => $this->record->name,
                            'replyText' => $data['admin_reply'],
                            'originalMessage' => $this->record->message,
                        ], function ($m) {
                            $m->to($this->record->email, $this->record->name ?: $this->record->email)
                                ->subject('TavlaTV — Bildirimine Yanıt (#'.$this->record->id.')');
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
