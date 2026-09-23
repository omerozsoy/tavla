<?php

namespace App\Filament\Pages;

use App\Models\Message;
use App\Models\User;
use App\Support\OfficialMessenger;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Str;

/**
 * Gelen Cevaplar — "Tavla TV Yönetim" resmi hesabına oyunculardan gelen DM'leri okur ve
 * cevaplar. Sol sütun: cevap yazan oyuncular (son mesaja göre sıralı, okunmamış rozeti);
 * sağ: seçili konuşmanın tam dökümü + cevap kutusu. Konuşma seçilince gelenler okundu
 * işaretlenir. Cevap OfficialMessenger ile (yine "Tavla TV Yönetim" kimliğiyle) gider.
 */
class PlayerReplies extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-inbox-arrow-down';

    protected static ?string $navigationLabel = 'Gelen Cevaplar';

    protected static ?string $title = 'Gelen Cevaplar';

    protected static ?string $navigationGroup = 'İletişim';

    protected static ?int $navigationSort = 1;

    protected static string $view = 'filament.pages.player-replies';

    public ?int $selectedUserId = null;

    public string $reply = '';

    /** Menüde okunmamış gelen cevap sayısı rozeti (hesap yoksa null -> gereksiz oluşturma yok). */
    public static function getNavigationBadge(): ?string
    {
        $officialId = User::where('email', OfficialMessenger::EMAIL)->value('id');
        if (! $officialId) {
            return null;
        }
        $n = Message::where('receiver_id', $officialId)->whereNull('read_at')->count();

        return $n > 0 ? (string) $n : null;
    }

    private function officialId(): int
    {
        return OfficialMessenger::account()->id;
    }

    /** Resmi hesaba ≥1 mesaj göndermiş oyuncular (cevap verenler), son mesaja göre sıralı. */
    public function conversations(): array
    {
        $official = $this->officialId();
        $partnerIds = Message::where('receiver_id', $official)
            ->select('sender_id')->distinct()->pluck('sender_id');
        if ($partnerIds->isEmpty()) {
            return [];
        }

        $users = User::whereIn('id', $partnerIds)->get()->keyBy('id');
        $rows = [];
        foreach ($partnerIds as $pid) {
            $u = $users->get($pid);
            if (! $u) {
                continue;
            }
            $last = Message::where(fn ($q) => $q->where('sender_id', $official)->where('receiver_id', $pid))
                ->orWhere(fn ($q) => $q->where('sender_id', $pid)->where('receiver_id', $official))
                ->orderByDesc('created_at')->orderByDesc('id')->first();
            $unread = Message::where('sender_id', $pid)->where('receiver_id', $official)->whereNull('read_at')->count();
            $snippet = Str::limit((string) ($last->body ?? ''), 60);
            $rows[] = [
                'id' => (int) $pid,
                'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
                'snippet' => $snippet !== '' ? $snippet : '📷 Görsel',
                'unread' => $unread,
                'ts' => optional($last?->created_at)->timestamp ?? 0,
            ];
        }
        usort($rows, fn ($a, $b) => $b['ts'] <=> $a['ts']);

        return $rows;
    }

    /** Seçili oyuncuyla tam konuşma (kronolojik). */
    public function thread(): array
    {
        if (! $this->selectedUserId) {
            return [];
        }
        $official = $this->officialId();
        $pid = $this->selectedUserId;

        return Message::where(fn ($q) => $q->where('sender_id', $official)->where('receiver_id', $pid))
            ->orWhere(fn ($q) => $q->where('sender_id', $pid)->where('receiver_id', $official))
            ->orderBy('created_at')->orderBy('id')
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'mine' => $m->sender_id === $official, // "yönetim" tarafı (sağda)
                'body' => (string) $m->body,
                'image' => $m->image ?? null,
                'at' => optional($m->created_at)->format('d.m.Y H:i'),
            ])
            ->all();
    }

    public function selectedName(): ?string
    {
        if (! $this->selectedUserId) {
            return null;
        }
        $u = User::find($this->selectedUserId);

        return $u ? ($u->nickname ?: $u->first_name ?: 'Oyuncu') : null;
    }

    public function select(int $userId): void
    {
        $this->selectedUserId = $userId;
        $this->reply = '';
        $official = $this->officialId();
        Message::where('sender_id', $userId)->where('receiver_id', $official)
            ->whereNull('read_at')->update(['read_at' => now()]);
    }

    public function sendReply(): void
    {
        $body = trim($this->reply);
        if (! $this->selectedUserId || $body === '') {
            Notification::make()->title('Cevap boş olamaz.')->danger()->send();

            return;
        }
        $to = User::find($this->selectedUserId);
        if (! $to) {
            Notification::make()->title('Oyuncu bulunamadı.')->danger()->send();

            return;
        }
        OfficialMessenger::sendTo($to, $body);
        $this->reply = '';
        Notification::make()->title('Cevap gönderildi.')->success()->send();
    }
}
