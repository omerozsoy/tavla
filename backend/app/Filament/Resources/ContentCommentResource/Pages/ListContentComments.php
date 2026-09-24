<?php

namespace App\Filament\Resources\ContentCommentResource\Pages;

use App\Filament\Resources\ContentCommentResource;
use Filament\Resources\Pages\ListRecords;

class ListContentComments extends ListRecords
{
    protected static string $resource = ContentCommentResource::class;

    // Yorumlar yalniz siteden (kullanicidan) gelir; panelden yeni olusturma yok.
    protected function getHeaderActions(): array
    {
        return [];
    }
}
