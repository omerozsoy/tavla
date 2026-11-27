<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PhotoAnalysisResource\Pages;
use App\Models\PhotoAnalysis;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

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

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Placeholder::make('status')->label('Durum')
                ->content(fn (?PhotoAnalysis $r) => $r?->status ?? '—'),
            Forms\Components\Placeholder::make('valid')->label('Öz-denetim')
                ->content(fn (?PhotoAnalysis $r) => $r?->valid ? '✓ geçerli' : '✗ güvenilmez'),
            Forms\Components\Placeholder::make('image_path')->label('Görsel yolu (private disk)')
                ->content(fn (?PhotoAnalysis $r) => $r?->image_path ?? '—')->columnSpanFull(),
            Forms\Components\Placeholder::make('debug')->label('Tanıma debug')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->debug, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('position')->label('Yapısal konum')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->position, JSON_PRETTY_PRINT) ?: '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('hint')->label('gnubg hint')
                ->content(fn (?PhotoAnalysis $r) => json_encode($r?->hint, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('error')->label('Hata')
                ->content(fn (?PhotoAnalysis $r) => $r?->error ?: '—'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('user.nickname')->label('Kullanıcı')->default('—'),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->color(fn (string $state) => match ($state) {
                        'done' => 'success', 'invalid' => 'warning', 'failed' => 'danger', default => 'gray',
                    }),
                Tables\Columns\IconColumn::make('valid')->label('Geçerli')->boolean(),
                Tables\Columns\TextColumn::make('debug.board_conf')->label('Board'),
                Tables\Columns\TextColumn::make('debug.checkers')->label('Taş'),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')
                    ->options(['pending' => 'pending', 'done' => 'done', 'invalid' => 'invalid', 'failed' => 'failed']),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('İncele'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
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
