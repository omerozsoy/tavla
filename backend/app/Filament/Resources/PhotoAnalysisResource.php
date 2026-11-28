<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PhotoAnalysisResource\Pages;
use App\Models\PhotoAnalysis;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Foto Analizleri": kullanicilarin yukledigi tahta fotograflarinin tanima + gnubg hint kayitlari.
 * Kalibrasyon/kalite incelemesi: board_conf, tespit sayisi, oz-denetim (valid), yapisal konum ve
 * hint burada gorulur. SALT inceleme (panelden olusturma yok).
 */
class PhotoAnalysisResource extends Resource
{
    protected static ?string $model = PhotoAnalysis::class;

    protected static ?string $navigationIcon = 'heroicon-o-camera';

    protected static ?string $navigationLabel = 'Foto Analizleri';

    protected static ?string $modelLabel = 'foto analizi';

    protected static ?string $pluralModelLabel = 'Foto Analizleri';

    protected static ?string $navigationGroup = 'Oyun';

    public static function canCreate(): bool
    {
        return false;
    }

    // Panel YALNIZ kullanicilarin "hatali tarama bildir" ile isaretledigi kayitlari gosterir (inceleme
    // kuyrugu). Bildirilmemis analizler listede YOK.
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->labelable();
    }

    public static function form(Form $form): Form
    {
        // SALT İNCELEME (read-only). Gerçek düzeltme React SPA'da: liste "Düzelt" -> /foto-duzelt/<id>.
        return $form->schema([
            Forms\Components\Placeholder::make('status')->label('Durum')
                ->content(fn (?PhotoAnalysis $r) => $r?->status ?? '—'),
            Forms\Components\Placeholder::make('valid')->label('Öz-denetim')
                ->content(fn (?PhotoAnalysis $r) => $r?->valid ? '✓ geçerli' : '✗ güvenilmez'),
            Forms\Components\Placeholder::make('reported_at')->label('Hatalı bildirimi')
                ->content(fn (?PhotoAnalysis $r) => $r?->reported_at ? '⚑ '.$r->reported_at->format('d.m.Y H:i') : '—'),
            Forms\Components\Placeholder::make('debug')->label('Tanıma debug')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->debug, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('position')->label('Tanınan konum (ham)')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->position, JSON_PRETTY_PRINT) ?: '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('hint')->label('gnubg hint')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->hint, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('ground_truth')->label('Eğitim etiketi (ground_truth)')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->ground_truth, JSON_PRETTY_PRINT) ?: '— (henüz düzeltilmedi)')
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('reported_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('user.nickname')->label('Kullanıcı')->default('—'),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->color(fn (string $state) => match ($state) {
                        'done' => 'success', 'invalid' => 'warning', 'failed' => 'danger', default => 'gray',
                    }),
                Tables\Columns\IconColumn::make('valid')->label('Geçerli')->boolean(),
                Tables\Columns\TextColumn::make('reported_at')->label('Bildirildi')->dateTime('d.m.Y H:i')->sortable(),
                Tables\Columns\TextColumn::make('review_status')->label('İnceleme')->badge()
                    ->placeholder('—')->color(fn (?string $state) => $state === 'labeled' ? 'success' : 'gray'),
                Tables\Columns\TextColumn::make('debug.board_conf')->label('Board'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')
                    ->options(['pending' => 'pending', 'done' => 'done', 'invalid' => 'invalid', 'failed' => 'failed']),
                Tables\Filters\Filter::make('unlabeled')->label('Henüz düzeltilmemiş')
                    ->query(fn ($query) => $query->whereNull('review_status'))->default(),
                // Temsili etiket: bildirilmemiş, tanıması güvenilir (valid+done), henüz etiketsiz = "doğru adayları".
                Tables\Filters\Filter::make('correct_candidates')->label('Doğru adayları')
                    ->query(fn ($query) => $query->whereNull('reported_at')->where('status', 'done')
                        ->where('valid', true)->whereNull('review_status')),
            ])
            ->actions([
                // Gerçek Board'da düzelt (React SPA; admin oturumu açık sekmede). İnceleme sayfası salt-görüntü.
                Tables\Actions\Action::make('duzelt')->label('Düzelt')->icon('heroicon-o-pencil-square')
                    ->color('primary')->url(fn (PhotoAnalysis $r) => "/foto-duzelt/{$r->id}")->openUrlInNewTab(),
                Tables\Actions\EditAction::make()->label('İncele'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ])
            ->bulkActions([
                // Seçili doğru-taranmış fotoları eğitim etiketi olarak onayla (ground_truth = tanınan konum).
                Tables\Actions\BulkAction::make('markCorrect')->label('Doğru olarak işaretle')
                    ->icon('heroicon-o-check-badge')->color('success')->requiresConfirmation()
                    ->action(fn ($records) => $records->each->markCorrect()),
                Tables\Actions\DeleteBulkAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPhotoAnalyses::route('/'),
            'edit' => Pages\EditPhotoAnalysis::route('/{record}/edit'),
        ];
    }
}
