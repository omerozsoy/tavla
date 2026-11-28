<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PhotoAnalysisResource\Pages;
use App\Models\PhotoAnalysis;
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
        // Düzenleme/inceleme sayfası YOK (ham JSON dökümleri admin işine yaramıyordu). Düzeltme React
        // SPA'da: liste "Düzelt" -> /foto-duzelt/<id>. form() yalnız soyut sözleşme için boş.
        return $form->schema([]);
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
                // Panel İÇİNDE gerçek Board düzeltme sayfası (iframe) — admin panelden çıkmaz.
                Tables\Actions\Action::make('duzelt')->label('Düzelt')->icon('heroicon-o-pencil-square')
                    ->color('primary')->url(fn (PhotoAnalysis $r) => PhotoAnalysisResource::getUrl('duzelt', ['record' => $r])),
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
            'duzelt' => Pages\DuzeltPhotoAnalysis::route('/{record}/duzelt'),
        ];
    }
}
