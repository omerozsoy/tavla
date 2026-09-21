<?php

namespace App\Http\Controllers;

use App\Models\BugReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// "Hata Bildir": sayfanin sag kenarindaki butondan gonderilen kullanici hata bildirimi.
// HALKA ACIK (misafir de bildirebilir) ama giris yapmissa otomatik iliskilendirilir.
// Ekran goruntusu base64 data-URL olarak gelir (avatar akisiyla ayni sadelik); burada
// cozup public/uploads/bug-reports altina dosya olarak yazariz (DB'de yalniz yol kalir).
class BugReportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'page'       => ['nullable', 'string', 'max:300'],
            'url'        => ['nullable', 'string', 'max:500'],
            'message'    => ['required', 'string', 'min:3', 'max:5000'],
            'name'       => ['nullable', 'string', 'max:120'],
            'email'      => ['nullable', 'email', 'max:190'],
            // Ekran goruntusu: data:image/...;base64,... (opsiyonel). ~8 MB base64 tavani.
            'screenshot' => ['nullable', 'string', 'max:11000000'],
        ]);

        // Giris yapmissa (Bearer token varsa) kullaniciyi iliskilendir; yoksa misafir.
        $user = $request->user() ?? auth('sanctum')->user();

        $screenshotPath = null;
        if (! empty($data['screenshot'])) {
            $screenshotPath = $this->saveScreenshot($data['screenshot']);
        }

        $report = BugReport::create([
            'user_id'    => $user?->id,
            'name'       => $data['name'] ?? ($user?->nickname),
            'email'      => $data['email'] ?? ($user?->email),
            'page'       => $data['page'] ?? null,
            'url'        => $data['url'] ?? null,
            'message'    => $data['message'],
            'screenshot' => $screenshotPath,
            'user_agent' => substr((string) $request->userAgent(), 0, 400),
            'status'     => 'new',
        ]);

        // Yeni bildirimi yoneticiye e-posta ile ilet (best-effort: mail patlarsa
        // kullanicinin bildirimi yine kaydedilir; hatayi yalniz logla).
        $this->notifyAdmin($report);

        return response()->json(['ok' => true, 'id' => $report->id], 201);
    }

    // Bildirimi config('mail.bug_report_to') adres(ler)ine gonder; ekran goruntusu varsa ekle.
    private function notifyAdmin(BugReport $report): void
    {
        $to = config('mail.bug_report_to');
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

        $reporter = $report->name
            ? $report->name.($report->email ? ' <'.$report->email.'>' : '')
            : 'Misafir'.($report->email ? ' <'.$report->email.'>' : '');
        $adminUrl = rtrim((string) config('app.url'), '/').'/admin/bug-reports/'.$report->id.'/edit';

        $body = "Yeni hata bildirimi (#{$report->id})\n\n"
            ."Sayfa: ".($report->page ?: '—')."\n"
            ."Adres: ".($report->url ?: '—')."\n"
            ."Bildiren: {$reporter}\n"
            ."Tarih: ".$report->created_at->toDateTimeString()."\n"
            ."Tarayıcı: ".($report->user_agent ?: '—')."\n\n"
            ."Açıklama:\n{$report->message}\n\n"
            ."Yönetim panelinde görüntüle:\n{$adminUrl}\n";

        // Ekran goruntusunun tam yolu (uploads diski = public/uploads).
        $shotPath = $report->screenshot ? Storage::disk('uploads')->path($report->screenshot) : null;

        try {
            Mail::raw($body, function ($m) use ($recipients, $report, $shotPath) {
                $m->to($recipients)->subject('TavlaTv — Yeni Hata Bildirimi #'.$report->id);
                if ($report->email) {
                    $m->replyTo($report->email, $report->name ?: $report->email);
                }
                if ($shotPath && is_file($shotPath)) {
                    $m->attach($shotPath);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('Hata bildirimi e-postasi gonderilemedi: '.$e->getMessage(), ['report_id' => $report->id]);
        }
    }

    // base64 data-URL -> uploads diskinde dosya. Yalniz gercek gorsel MIME'lerini kabul et.
    private function saveScreenshot(string $dataUrl): ?string
    {
        if (! preg_match('/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/s', $dataUrl, $m)) {
            return null; // gecersiz/desteklenmeyen format -> sessizce atla (bildirim yine kaydedilir)
        }
        $ext = $m[1] === 'jpeg' ? 'jpg' : $m[1];
        $binary = base64_decode($m[2], true);
        if ($binary === false || strlen($binary) > 8 * 1024 * 1024) {
            return null; // bozuk veya 8 MB'tan buyuk -> atla
        }
        // Data-URL MIME'ı client tarafından yazılabilir; gerçek dosya imzasını ayrıca doğrula.
        $info = @getimagesizefromstring($binary);
        $mime = is_array($info) ? (string) ($info['mime'] ?? '') : '';
        $allowed = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
        ];
        if (! $info || ($allowed[$m[1]] ?? '') !== $mime) {
            return null;
        }
        $pixels = (int) ($info[0] ?? 0) * (int) ($info[1] ?? 0);
        if ($pixels <= 0 || $pixels > 40_000_000) {
            return null;
        }
        $path = 'bug-reports/'.date('Y-m').'/'.Str::random(24).'.'.$ext;
        Storage::disk('uploads')->put($path, $binary);

        return $path;
    }
}
