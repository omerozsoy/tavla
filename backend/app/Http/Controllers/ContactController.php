<?php

namespace App\Http\Controllers;

use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

// İletişim / turnuva organizasyonu talebi: footer "İletişim" sayfasindaki ve turnuva
// organizasyonu landing'lerindeki formdan gonderilir. HALKA ACIK (misafir de gonderebilir);
// giris yapmissa Bearer token'dan kullanici iliskilendirilir. BugReportController ile ayni desen.
class ContactController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => ['required', 'string', 'min:2', 'max:120'],
            'org'          => ['nullable', 'string', 'max:160'],
            'email'        => ['nullable', 'email', 'max:190'],
            'phone'        => ['nullable', 'string', 'max:40'],
            'subject'      => ['nullable', 'string', 'max:40'],
            'city'         => ['nullable', 'string', 'max:80'],
            'event_date'   => ['nullable', 'string', 'max:60'],
            'participants' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'message'      => ['required', 'string', 'min:5', 'max:5000'],
            'source_page'  => ['nullable', 'string', 'max:120'],
            'url'          => ['nullable', 'string', 'max:500'],
        ]);

        // En az bir geri-donus kanali (e-posta veya telefon) olsun.
        if (empty($data['email']) && empty($data['phone'])) {
            return response()->json([
                'message' => 'Size dönebilmemiz için e-posta veya telefon bırakın.',
                'errors' => ['email' => ['E-posta veya telefon gerekli.']],
            ], 422);
        }

        // Giris yapmissa (Bearer token varsa) kullaniciyi iliskilendir; yoksa misafir.
        $user = $request->user() ?? auth('sanctum')->user();

        $contact = ContactMessage::create([
            'user_id'      => $user?->id,
            'name'         => $data['name'],
            'org'          => $data['org'] ?? null,
            'email'        => $data['email'] ?? ($user?->email),
            'phone'        => $data['phone'] ?? null,
            'subject'      => $data['subject'] ?? null,
            'city'         => $data['city'] ?? null,
            'event_date'   => $data['event_date'] ?? null,
            'participants' => $data['participants'] ?? null,
            'message'      => $data['message'],
            'source_page'  => $data['source_page'] ?? null,
            'url'          => $data['url'] ?? null,
            'user_agent'   => substr((string) $request->userAgent(), 0, 400),
            'status'       => 'new',
        ]);

        // Yeni talebi yoneticiye e-posta ile ilet (best-effort).
        $this->notifyAdmin($contact);

        return response()->json(['ok' => true, 'id' => $contact->id], 201);
    }

    // Talebi config('mail.contact_to') (yoksa mail.bug_report_to) adres(ler)ine gonder.
    private function notifyAdmin(ContactMessage $contact): void
    {
        $to = config('mail.contact_to') ?: config('mail.bug_report_to');
        if (empty($to)) {
            return;
        }
        $recipients = collect(explode(',', (string) $to))
            ->map(fn ($e) => trim($e))
            ->filter()
            ->all();
        if (empty($recipients)) {
            return;
        }

        $subjectLabel = ContactMessage::SUBJECTS[$contact->subject] ?? ($contact->subject ?: '—');
        $adminUrl = rtrim((string) config('app.url'), '/').'/admin/contact-messages/'.$contact->id.'/edit';

        $body = "Yeni iletişim / turnuva organizasyonu talebi (#{$contact->id})\n\n"
            ."Ad: {$contact->name}\n"
            ."Kurum: ".($contact->org ?: '—')."\n"
            ."Talep türü: {$subjectLabel}\n"
            ."E-posta: ".($contact->email ?: '—')."\n"
            ."Telefon: ".($contact->phone ?: '—')."\n"
            ."İl: ".($contact->city ?: '—')."\n"
            ."Etkinlik tarihi: ".($contact->event_date ?: '—')."\n"
            ."Katılımcı sayısı: ".($contact->participants ?: '—')."\n"
            ."Gönderilen sayfa: ".($contact->source_page ?: '—')."\n"
            ."Tarih: ".$contact->created_at->toDateTimeString()."\n\n"
            ."Mesaj:\n{$contact->message}\n\n"
            ."Yönetim panelinde görüntüle:\n{$adminUrl}\n";

        try {
            Mail::raw($body, function ($m) use ($recipients, $contact) {
                $m->to($recipients)->subject('TavlaTv — Yeni İletişim Talebi #'.$contact->id);
                if ($contact->email) {
                    $m->replyTo($contact->email, $contact->name ?: $contact->email);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('İletişim talebi e-postasi gonderilemedi: '.$e->getMessage(), ['contact_id' => $contact->id]);
        }
    }
}
