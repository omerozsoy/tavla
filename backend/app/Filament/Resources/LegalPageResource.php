<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LegalPageResource\Pages;
use App\Models\LegalPage;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Hukuki/Yasal Sayfalar: KVKK Aydınlatma Metni, Gizlilik Politikası, Çerez Politikası,
 * Kullanım Koşulları, Üyelik Sözleşmesi. Rich-text içerik + SEO + yayın kontrolü.
 * Frontend içeriği slug ile veritabanından çeker (metinler React'e gömülü DEĞİL).
 */
class LegalPageResource extends Resource
{
    protected static ?string $model = LegalPage::class;

    protected static ?string $slug = 'hukuki-sayfalar';

    protected static ?string $navigationIcon = 'heroicon-o-scale';

    protected static ?string $navigationLabel = 'Hukuki Sayfalar';

    protected static ?string $modelLabel = 'hukuki sayfa';

    protected static ?string $pluralModelLabel = 'Hukuki Sayfalar';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 2;

    // Sabit 5 sayfa; panelden yeni eklenmez/silinmez (slug frontend route'una bağlı).
    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('title')->label('Başlık')
                ->required()->maxLength(160)->columnSpanFull(),

            Forms\Components\TextInput::make('slug')->label('Adres (slug)')
                ->disabled()->dehydrated(false)
                ->helperText('Frontend adresine bağlı, değiştirilemez. Örn: /kvkk')
                ->columnSpanFull(),

            Forms\Components\RichEditor::make('body')->label('İçerik')
                ->toolbarButtons([
                    'bold', 'italic', 'underline', 'strike',
                    'h2', 'h3',
                    'bulletList', 'orderedList',
                    'link', 'blockquote',
                    'redo', 'undo',
                ])
                ->fileAttachmentsDisk('uploads')
                ->fileAttachmentsDirectory('hukuki')
                ->fileAttachmentsVisibility('public')
                ->helperText('Biçimlendirilmiş metin. Köşeli parantezli alanları ([ŞİRKET UNVANI] vb.) şirket bilgileriyle doldurun.')
                ->columnSpanFull(),

            Forms\Components\TextInput::make('seo_title')->label('SEO Başlığı')
                ->maxLength(160)
                ->helperText('Arama sonuçlarında ve sekme başlığında görünür. Boşsa sayfa başlığı kullanılır.')
                ->columnSpanFull(),
            Forms\Components\Textarea::make('seo_description')->label('SEO Açıklaması')
                ->maxLength(320)->rows(2)
                ->helperText('Arama sonuçlarındaki kısa açıklama (meta description).')
                ->columnSpanFull(),

            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0),
            Forms\Components\Toggle::make('active')->label('Yayında')->default(true)
                ->helperText('Kapalıysa sayfa ziyaretçilere gösterilmez.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable(),
                Tables\Columns\TextColumn::make('slug')->label('Adres')
                    ->formatStateUsing(fn ($state) => '/'.$state)->badge(),
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable(),
                Tables\Columns\IconColumn::make('active')->label('Yayında')->boolean(),
                Tables\Columns\TextColumn::make('updated_at')->label('Güncellendi')->dateTime('d.m.Y H:i'),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLegalPages::route('/'),
            'edit' => Pages\EditLegalPage::route('/{record}/edit'),
        ];
    }
}
